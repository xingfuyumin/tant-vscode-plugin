

import * as vscode from 'vscode';
import Color from './color';
import Intl from './intl';
import SVG from './svg';

export function activate(context: vscode.ExtensionContext) {
	const svg = new SVG(context);
	const intl = new Intl(context);
	const color = new Color(context);
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
		intl.checkConfig(true);
		svg.checkConfig(true);
		color.checkConfig(true);
	}));
}
export function deactivate() { }
