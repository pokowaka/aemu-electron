// Copyright (C) 2021 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import commandLineArgs from "command-line-args";
import { log } from "electron-log";
import * as fs from "fs";
import * as microtime from "microtime";
import { fileURLToPath } from "url";
import { EmulatorDiscovery } from "./discovery";
import { Emulator, EmulatorEvent, EmulatorKeyEvent } from "./emulator";
import { Image } from "./proto/emulator_controller_pb";

/**
 * An EmulatorView is a view upon a running emulator. It is responsible for:
 *
 * - Drawing incoming frames from the emulator.
 * - Notifying the emulator when the drawing size has changed.
 * - Sending mouse clicks.
 * - Sending keyboard events.
 *
 */
class EmulatorView {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	button: number;
	imagedata: ImageData;
	emulator: Emulator | undefined;
	discovery: EmulatorDiscovery;
	emulatorDiv: HTMLDivElement;

	constructor(emulator: Emulator | null) {
		this.canvas = <HTMLCanvasElement>document.getElementById("canvas")!;
		this.emulatorDiv = <HTMLDivElement>document.getElementById("emulator");
		this.ctx = this.canvas.getContext("2d")!;
		this.imagedata = this.ctx.createImageData(1, 1);
		this.button = 0;
		this.discovery = new EmulatorDiscovery();

		if (!!emulator) {
			this.registerEmulator(emulator);
		} else {
			this.discoverEmulators();
		}
		this.addListeners();
	}

	private registerEmulator(emulator: Emulator) {
		this.emulator = emulator;
		this.emulator.on(EmulatorEvent.frame, this.frameReceiver.bind(this));
		this.emulator.resize(
			this.emulatorDiv.clientWidth,
			this.emulatorDiv.clientHeight
		);
	}

	private discoverEmulators() {
		const pid = this.discovery.pids().next();

		if (!pid.done) {
			this.registerEmulator(this.discovery.getEmulator(pid.value));
		} else {
			this.discovery.on("add", (pid) => {
				this.registerEmulator(this.discovery.getEmulator(pid));
			});
		}
	}

	/** Registers mouse, keyboard & resize listeners. */
	private addListeners() {
		this.canvas.addEventListener("mousedown", (e) => {
			const rect = this.canvas.getBoundingClientRect();
			this.button = e.button === 0 ? 1 : e.button === 2 ? 2 : 0;
			this.emulator?.sendMouse({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				button: this.button,
			});
		});

		this.canvas.addEventListener("mousemove", (e) => {
			if (this.button !== 0) {
				const rect = this.canvas.getBoundingClientRect();
				this.emulator?.sendMouse({
					x: e.clientX - rect.left,
					y: e.clientY - rect.top,
					button: this.button,
				});
			}
		});

		document.addEventListener("mouseup", (e) => {
			this.button = 0;
			const rect = this.canvas.getBoundingClientRect();
			this.emulator?.sendMouse({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				button: this.button,
			});
		});

		document.addEventListener("keydown", (e) => {
			this.emulator?.sendKey(EmulatorKeyEvent.keydown, e.key);
		});

		document.addEventListener("keyup", (e) => {
			this.emulator?.sendKey(EmulatorKeyEvent.keyup, e.key);
		});

		window.addEventListener("resize", () => {
			this.emulator?.resize(
				this.emulatorDiv.clientWidth,
				this.emulatorDiv.clientHeight
			);
		});
	}

	private frameReceiver(img: Image) {
		// TODO(pokowaka): Replace this with some native magic for extra speed.
		const receivedUs = microtime.now();
		const format = img.getFormat()!;
		const w = format.getWidth();
		const h = format.getHeight();

		// Make sure the canvas really matches up, otherwise weirdness!
		if (w != this.canvas.width || h != this.canvas.height) {
			this.canvas.width = w;
			this.canvas.height = h;
			this.imagedata = this.ctx.createImageData(w, h);
		}

		// Get the data and render.
		const handle = format.getTransport()?.getHandle()!;
		const contents = fs.readFileSync(fileURLToPath(handle));
		var j = 0;
		for (var i = 0; i < w * h * 3; i += 3) {
			this.imagedata.data[j++] = contents[i];
			this.imagedata.data[j++] = contents[i + 1];
			this.imagedata.data[j++] = contents[i + 2];
			this.imagedata.data[j++] = 0xff;
		}
		this.ctx.putImageData(this.imagedata, 0, 0);
		const renderedUs = microtime.now();
		console.log(
			`Seq: ${img.getSeq()}, send: ${img.getTimestampus()}, received: ${receivedUs}, rendered: ${renderedUs}`
		);
	}
}

// Main entry:

const main = (options: commandLineArgs.CommandLineOptions) => {
	// Redirect logging to the main process.
	console.log = log;
	console.log(options);
	let emulator: Emulator | null = null;

	if (options["grpc"]) {
		const grpc = options["grpc"]!;
		console.log("Using direct connection to `grpc`");
		emulator = new EmulatorDiscovery().getEmulatorToHost(grpc);
	}

	new EmulatorView(emulator);
};

main(JSON.parse(window.process.argv[window.process.argv.length - 1]));
