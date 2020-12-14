import { app, BrowserWindow, Menu } from "electron";
import debug from "electron-debug";
import unhandled from "electron-unhandled";
import * as path from "path";
import is from "electron-util";

app.on("ready", () => {
	console.log("App is ready");
});

unhandled();
debug();

app.setAppUserModelId("com.pokowaka@gmail.com.aemu-electron");

// Prevent window from being garbage collected
let mainWindow: BrowserWindow | undefined;


const createMainWindow = async () => {
	const win = new BrowserWindow({
		title: "Android Emulator View",
		show: false,
		width: 1080 / 3,
		height: 1920 / 3,
		webPreferences: {
			nodeIntegration: true
	}});




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
