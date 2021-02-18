import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
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

const optionDefinitions: commandLineUsage.OptionDefinition[] = [
	{
		name: "grpc",
		type: String,
		alias: "g",
		description:
			"Use a direct gRPC connection to the given address, disabling emulator discovery and auth."
	},
	{
		name: "width",
		alias: "w",
		type: Number,
		defaultValue: 1080,
		description: "The initial width of the displayed emulator."
	},
	{
		name: "height",
		alias: "h",
		type: Number,
		defaultValue: 1920,
		description: "Thie initial height of the displayed emulator."
	},
	{
		name: "resize",
		alias: "r",
		type: Boolean,
		defaultValue: true,
		description:
			"True if you can resize the window, or false to use fixed size."
	},
	{
		name: "help",
		type: Boolean,
		defaultValue: false,
		description:
			"Displays this usage."
	}
];

const optionUsage: commandLineUsage.Section[] = [
	{
		header: "A simple electron UI for the android emulator",
		content:
			"This app tries to connect to a running emulator, you can then interact with it."
	},
	{
		header: "Options",
		optionList: optionDefinitions
	}
];
let options: commandLineArgs.CommandLineOptions;

const createMainWindow = async () => {
	const win = new BrowserWindow({
		title: "Android Emulator View",
		show: false,
		width: options.width,
		height: options.height,
		resizable: options.resize,
		useContentSize: true,
		webPreferences: {
			nodeIntegration: true,
			additionalArguments: [JSON.stringify(options)]
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
	const argv: string[] = process.argv;
	options = commandLineArgs(optionDefinitions, { argv: argv });
	if (options["help"]) {
		const usage = commandLineUsage(optionUsage);
		console.log(usage);
		app.quit();
	}

	mainWindow = await createMainWindow();
})();
