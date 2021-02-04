import * as fs from "fs";
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

	constructor() {
		this.canvas = <HTMLCanvasElement>document.getElementById("canvas")!;
		this.emulatorDiv = <HTMLDivElement>document.getElementById("emulator");
		this.ctx = this.canvas.getContext("2d")!;
		this.imagedata = this.ctx.createImageData(1, 1);
		this.button = 0;
		this.discovery = new EmulatorDiscovery();
		const pid = this.discovery.pids().next();

		if (!pid.done) {
			this.emulator = this.discovery.getEmulator(pid.value);
			this.emulator.on(EmulatorEvent.frame, this.frameReceiver.bind(this));
			this.emulator.resize(this.emulatorDiv.clientWidth, this.emulatorDiv.clientHeight);
		} else {
			this.discovery.on("add", pid => {
				this.emulator = this.discovery.getEmulator(pid);
				this.emulator.on(EmulatorEvent.frame, this.frameReceiver.bind(this));
				this.emulator.resize(this.emulatorDiv.clientWidth, this.emulatorDiv.clientHeight);
			});
		}

		this.addListeners();
	}

	/** Registers mouse, keyboard & resize listeners. */
	private addListeners() {
		this.canvas.addEventListener("mousedown", e => {
			const rect = this.canvas.getBoundingClientRect();
			this.button = e.button === 0 ? 1 : e.button === 2 ? 2 : 0;
			this.emulator?.sendMouse({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				button: this.button
			});
		});

		this.canvas.addEventListener("mousemove", e => {
			if (this.button !== 0) {
				const rect = this.canvas.getBoundingClientRect();
				this.emulator?.sendMouse({
					x: e.clientX - rect.left,
					y: e.clientY - rect.top,
					button: this.button
				});
			}
		});

		document.addEventListener("mouseup", e => {
			this.button = 0;
			const rect = this.canvas.getBoundingClientRect();
			this.emulator?.sendMouse({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				button: this.button
			});
		});

		document.addEventListener("keydown", e => {
			this.emulator?.sendKey(EmulatorKeyEvent.keydown, e.key);
		});

		document.addEventListener("keyup", e => {
			this.emulator?.sendKey(EmulatorKeyEvent.keyup, e.key);
		});

		window.addEventListener("resize", () => {
			this.emulator?.resize(this.emulatorDiv.clientWidth, this.emulatorDiv.clientHeight);
		});
	}

	private frameReceiver(img: Image) {
		// TODO(pokowaka): Replace this with some native magic for extra speed.
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
	}
}
new EmulatorView();
