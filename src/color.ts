import * as vscode from 'vscode';
import * as fs from 'fs';

const watch = require('watch');

class CompletionItemProvider implements vscode.CompletionItemProvider {
  private _data: { key: string, content: string, insert: string }[] = [];
  constructor(data: { key: string, content: string, insert: string }[]) {
    this._data = data;
  }
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    return this._data.map((item) => {
      const completionItem = new vscode.CompletionItem({ label: item.key, detail: `  ${item.content}`, description: '数数样式库' }, vscode.CompletionItemKind.Color);
      completionItem.insertText = item.insert;
      completionItem.filterText = item.key.split('').join('-');
      return completionItem;
    });
  }
  public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): any {
    return item;
  }
}

class HoverProvider implements vscode.HoverProvider {
  private _data: { key: string, content: string }[] = [];
  constructor(data: { key: string, content: string }[]) {
    this._data = data;
  }
  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    const text = document.getText(document.getWordRangeAtPosition(position));
    const obj = this._data.find(v => v.key === text);
    if (obj) {
      return new vscode.Hover([obj.content]);
    }
    return new vscode.Hover([]);
  }
}

class Color {
  private _dir = '';
  private _context;
  private _completionItemProvider: vscode.Disposable | undefined;
  private _hoverProvider: vscode.Disposable | undefined;
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.checkConfig(false);
  }
  checkConfig = (showWarn: boolean) => {
    let dir: string = vscode.workspace.getConfiguration('数数最强插件').get('css样式包路径') || '';
    dir = dir.trim();
    if (this._dir === dir) {
      return;
    }
    if (this._dir) {
      watch.unwatchTree(this._dir);
    }
    this._dir = dir;
    if (!this._dir) {
      if (showWarn) {
        vscode.window.showInformationMessage('【数数最强插件.css样式包路径】功能关闭');
      }
      if (this._completionItemProvider) {
        this._completionItemProvider.dispose();
      }
      if (this._hoverProvider) {
        this._hoverProvider.dispose();
      }
      return;
    }
    if (!fs.existsSync(this._dir)) {
      if (showWarn) {
        vscode.window.showInformationMessage('【数数最强插件.css样式包路径】配置路径不存在');
      }
      return;
    }
    if (showWarn) {
      vscode.window.showInformationMessage('【数数最强插件.css样式包路径】配置已经生效');
    }
    this._watchFile();
    this._readData();
  };
  private _watchFile = () => {
    watch.watchTree(this._dir, () => {
      this._readData();
    });
  };
  private _readData = () => {
    const content = fs.readFileSync(this._dir).toString();
    const strArr = content.split('\n');
    const colorMap: Record<string, {
      color: string;
      var: string;
      var2: String;
    }> = {};
    const data: { key: string, content: string, insert: string }[] = [];
    strArr.forEach((str: string) => {
      if (str.includes(': ') && str.includes('{')) {
        return;
      }
      if (str.includes('{') || str.includes('}')) {
        return;
      }
      const arr = str.split(':').map(v => v.trim());
      if (arr.length !== 2) {
        return;
      }
      arr[1] = arr[1].replace(';', '');
      if (arr[1].startsWith('#')) {
        colorMap[arr[0]] = {
          color: arr[1],
          var: arr[0],
          var2: arr[0],
        };
        data.push({ key: arr[1], content: arr[0], insert: `${arr[0]};` });
        data.push({ key: arr[0], content: '', insert: `${arr[0]};` });
      } else if (arr[1].startsWith('var')) {
        arr[1] = arr[1].replace('var(', '').replace(')', '');
        if (colorMap[arr[1]]) {
          colorMap[arr[1]].var2 = arr[0];
          data.push({ key: colorMap[arr[1]].color, content: arr[0], insert: `${arr[0]};` });
        }
        data.push({ key: arr[0], content: '', insert: `${arr[0]};` });
        data.push({ key: arr[1], content: arr[0], insert: `${arr[0]};` });
      } else {
        data.push({ key: arr[1], content: arr[0], insert: `${arr[0]};` });
        data.push({ key: arr[0], content: '', insert: `${arr[0]};` });
      }
    });
    if (this._completionItemProvider) {
      this._completionItemProvider.dispose();
    }
    this._completionItemProvider = vscode.languages.registerCompletionItemProvider(['css', 'less'], new CompletionItemProvider(data));
    this._context.subscriptions.push(this._completionItemProvider);
    if (this._hoverProvider) {
      this._hoverProvider.dispose();
    }
    this._hoverProvider = vscode.languages.registerHoverProvider(['css', 'less'], new HoverProvider(data));
    this._context.subscriptions.push(this._hoverProvider);

  };
}

export default Color;