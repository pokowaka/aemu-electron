import * as grpc from "@grpc/grpc-js";
import * as fs from "fs";
import * as emu from "./proto/emulator_controller_grpc_pb";
import { Empty } from "google-protobuf/google/protobuf/empty_pb";
import {
	ImageFormat,
	Image,
	ImageTransport,
	MouseEvent as MouseEvt
} from "./proto/emulator_controller_pb";
import * as tmp from "tmp";

class Emulator {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	client: emu.EmulatorControllerClient;
	mouse: { x: number; y: number; mousedown: boolean; button: number };
	width: number;
	height: number;
	imagedata: ImageData;
	tmpfile: tmp.FileResult;
	deviceWidth: number;
	deviceHeight: number;

	constructor() {
		this.client = new emu.EmulatorControllerClient(
			"localhost:8554",
			grpc.credentials.createInsecure()
		);
		// TODO(jansene): Make variable.
		this.deviceHeight = 1920;
		this.deviceWidth = 1080;
		this.width = 1080 / 3;
		this.height = 1920 / 3;
		this.canvas = <HTMLCanvasElement>document.getElementById("canvas")!;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.ctx = this.canvas.getContext("2d")!;
		this.imagedata = this.ctx.createImageData(this.width, this.height);
		this.mouse = { x: 0, y: 0, mousedown: false, button: 0 };
		this.tmpfile = tmp.fileSync();
		this.addListeners();
		this.deviceStatus();
		this.run();
	}

	sendMouse() {
		let scaleX = this.deviceWidth / this.canvas.width;
		let scaleY = this.deviceHeight / this.canvas.height;

		let x = Math.round(this.mouse.x * scaleX);
		let y = Math.round(this.mouse.y * scaleY);
		console.log(scaleY + " - " + this.canvas.height);
		var request = new MouseEvt();
		request.setX(x);
		request.setY(y);
		request.setButtons(this.mouse.mousedown ? this.mouse.button : 0);

		console.log("Send mouse: " + request.toString());
		this.client.sendMouse(request, err => {
			if (err) {
				console.log("Failed to deliver mouse: " + err);
			}
		});
	}

	deviceStatus() {
		this.client.getStatus(new Empty(), (err, response) => {
			var hwConfig = new Map<string, string>();
			const entryList = response.getHardwareconfig()!.getEntryList();
			for (var i = 0; i < entryList.length; i++) {
				const key = entryList[i].getKey();
				const val = entryList[i].getValue();
				hwConfig.set(key, val);
			}

			this.deviceWidth = +hwConfig.get("hw.lcd.width")!;
			this.deviceHeight = +hwConfig.get("hw.lcd.height")!;
		});
	}

	addListeners() {
		// Add the event listeners for mousedown, mousemove, and mouseup
		this.canvas.addEventListener("mousedown", e => {
			const rect = this.canvas.getBoundingClientRect();
			this.mouse = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				mousedown: true,
				// In browser's MouseEvent.button property,
				// 0 stands for left button and 2 stands for right button.
				button: e.button === 0 ? 1 : e.button === 2 ? 2 : 0
			};
			this.sendMouse();
		});

		this.canvas.addEventListener("mousemove", e => {
			if (this.mouse.mousedown) {
				const rect = this.canvas.getBoundingClientRect();
				this.mouse.x = e.clientX - rect.left;
				this.mouse.y = e.clientY - rect.top;
				this.sendMouse();
			}
		});

		document.addEventListener("mouseup", e => {
			const rect = this.canvas.getBoundingClientRect();
			this.mouse = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				mousedown: false,
				button: 0
			};
			this.sendMouse();
		});
	}

	resize(w: number, h: number) {
		this.width = w;
		this.height = h;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.imagedata = this.ctx.createImageData(this.width, this.height);
	}

	run() {
		console.log("Ready to stream.");
		// TODO(jansene): The size must match what the emulator is delivering, otherwise you'll get a garbled image.

		let transport = new ImageTransport();
		transport.setChannel(ImageTransport.TransportChannel.MMAP);
		transport.setHandle("file://" + this.tmpfile.name);

		let fmt = new ImageFormat();
		fmt.setHeight(1920 / 3);
		fmt.setWidth(1080 / 3);
		fmt.setFormat(ImageFormat.ImgFormat.RGBA8888);
		fmt.setTransport(transport);

		const stream = this.client.streamScreenshot(fmt);
		stream.on("data", (img: Image) => {
			// Make sure the ctx match up.
			const format = img.getFormat()!;
			if (
				format.getWidth() != this.canvas.width ||
				format.getHeight() != this.canvas.height
			) {
				this.resize(format.getWidth(), format.getHeight());
			}
			const contents = fs.readFileSync(this.tmpfile.name);
			for (var i = 0; i < this.canvas.width * this.canvas.height * 4; i++) {
				this.imagedata.data[i] = contents[i];
			}
			this.ctx.putImageData(this.imagedata, 0, 0);
		});
		stream.on("error", (err: Error) => {
			console.log("Failure: " + err.message);
		});
	}
}

new Emulator();
