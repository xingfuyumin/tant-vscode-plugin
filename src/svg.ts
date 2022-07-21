import * as vscode from 'vscode';
import fetch from 'node-fetch';

class CompletionItemProvider implements vscode.CompletionItemProvider {
  private _data: { key: string, url: string }[] = [];
  constructor(data: { key: string, url: string }[]) {
    this._data = data;
  }
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    return this._data.map((item) => {
      const completionItem = new vscode.CompletionItem({ label: item.key, description: '数数图标库' }, vscode.CompletionItemKind.Variable);
      completionItem.insertText = `<${item.key} />`;
      completionItem.filterText = `${item.key}-${item.key.substring(2).split('').join('-')}`
      const markdownString = new vscode.MarkdownString(`<img style="margin: 100px;" src="${item.url}"></img>`);
      markdownString.supportHtml = true;
      completionItem.documentation = markdownString;
      completionItem.command = {
        title: "import",
        command: 'tsimporter.importSymbol',
        arguments: [document, { name: item.key, module: '@tant/icons', isDefault: false }]
      };
      return completionItem;
    });
  }
  public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): any {
    return item;
  }
}

class HoverProvider implements vscode.HoverProvider {
  private _data: { key: string, url: string }[] = [];
  constructor(data: { key: string, url: string }[]) {
    this._data = data;
  }
  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    const text = document.getText(document.getWordRangeAtPosition(position));
    const obj = this._data.find(v => v.key === text);
    if (obj) {
      const markdownString = new vscode.MarkdownString(`<img style="margin: 100px;" src="${obj.url}"></img>`);
      markdownString.supportHtml = true;
      return new vscode.Hover(markdownString);
    }
    return new vscode.Hover([]);
  }
}

class SVG {
  private _context;
  private _completionItemProvider: vscode.Disposable | undefined;
  private _hoverProvider: vscode.Disposable | undefined;
  private _check: boolean | undefined = undefined;
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.checkConfig(false);
  }
  checkConfig = (showOpen: boolean) => {
    const check: boolean = vscode.workspace.getConfiguration('数数最强插件').get('开启图标预览功能') || false;
    if (this._check === check) {
      return;
    }
    this._check = check;
    if (!this._check) {
      if (showOpen) {
        vscode.window.showInformationMessage('【数数最强插件.开启图标预览功能】功能关闭');
      }
      if (this._completionItemProvider) {
        this._completionItemProvider.dispose();
      }
      if (this._hoverProvider) {
        this._hoverProvider.dispose();
      }
      return;
    }
    if (showOpen) {
      vscode.window.showInformationMessage('【数数最强插件.开启图标预览功能】功能已打开');
    }
    this._readData();
  };
  private _readData = () => {
    vscode.window.setStatusBarMessage('【数数最强插件】正在从figma请求svg资源');
    fetch('https://api.figma.com/v1/files/WQTCgsKXiS4DfsDPtHGEpk/components', {
      method: 'GET',
      headers: {
        'X-Figma-Token': 'figd_mQYHtpaYGreMdClMpY5Cb5eWXajh5MinaXrLARLv',
      },
    }).then((res: any) => {
      if (res?.status !== 200) {
        return null;
      }
      return res.json();
    }).then((res: any) => {
      if (res.status === 200) {
        const d = res?.meta?.components || [];
        const data: { key: string, url: string }[] = [];
        d.forEach((item: any) => {
          let name: string = item.name;
          const url: string = item.thumbnail_url;
          name = name.split('-').map((str: string) => `${str.substring(0, 1).toUpperCase()}${str.substring(1)}`).join('');
          data.push({
            key: `Ta${name}`,
            url,
          });
        });
        if (this._completionItemProvider) {
          this._completionItemProvider.dispose();
        }
        this._completionItemProvider = vscode.languages.registerCompletionItemProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact'], new CompletionItemProvider(data), 'Ta');
        this._context.subscriptions.push(this._completionItemProvider);
        if (this._hoverProvider) {
          this._hoverProvider.dispose();
        }
        this._hoverProvider = vscode.languages.registerHoverProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact'], new HoverProvider(data));
        this._context.subscriptions.unshift(this._hoverProvider);
      }
      vscode.window.setStatusBarMessage('');
    }).catch((err: any) => {
      vscode.window.setStatusBarMessage('');
      console.log(err);
    });
  };
}

export default SVG;