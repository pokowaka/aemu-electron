import { app, BrowserWindow } from "electron";
import debug from "electron-debug";
import unhandled from "electron-unhandled";
import is from "electron-util";
import * as path from "path";

app.on("ready", () => {
	console.log("App is ready");
});

unhandled();
debug();

app.setAppUserModelId("com.pokowaka@gmail.com.aemu-electron");

// Prevent window from being garbage collected
let mainWindow: BrowserWindow | undefined;

const createMainWindow = async () => {
	const argv: string[] = process.argv;
	let resize = true;
	let width = 1080;
	let height = 1920;

	if (argv.includes("-size")) {
		const dimensions = argv[argv.indexOf("-size") + 1];
		const extract = /(\d+)x(\d+)/.exec(dimensions);
		width = parseInt(extract![1]);
		height = parseInt(extract![2]);
		resize = false;
	}

	const win = new BrowserWindow({
		title: "Android Emulator View",
		show: false,
		width: width,
		height: height,
		resizable: resize,
		webPreferences: {
			nodeIntegration: true
		}
	});

	win.on("ready-to-show", () => {
		win.show();
	});

	win.on("closed", () => {
		// Dereference the window
		// For multiple windows store them in an array
		mainWindow = undefined;
	});

	await win.loadFile(path.join(__dirname, "index.html"));
	return win;
};

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
	app.quit();
}

app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

app.on("window-all-closed", () => {
	if (!is.is.macos) {
		app.quit();
	}
});

app.on("activate", () => {
	if (!mainWindow) {
		createMainWindow().then(win => {
			mainWindow = win;
		});
	}
});

(async () => {
	await app.whenReady();
	mainWindow = await createMainWindow();
})();
