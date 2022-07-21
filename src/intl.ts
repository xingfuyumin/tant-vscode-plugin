import * as vscode from 'vscode';
import * as fs from 'fs';

const watch = require('watch');

class CompletionItemProvider implements vscode.CompletionItemProvider {
  private _data: { key: string, content: string, tags: string, insert: string, hasRequest: false }[] = [];
  constructor(data: { key: string, content: string, tags: string, insert: string, hasRequest: false }[]) {
    this._data = data;
  }
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    return this._data.map((item) => {
      const completionItem = new vscode.CompletionItem({ label: item.content, detail: `  ${item.key}`, description: item.tags }, vscode.CompletionItemKind.Value);
      completionItem.insertText = item.insert;
      completionItem.filterText = item.content.split('').join('-');
      completionItem.command = {
        title: "import",
        command: 'tsimporter.importSymbol',
        arguments: [document, { name: 'formatMessage', module: 'tant-intl', isDefault: false }]
      };
      return completionItem;
    });
  }
  public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): any {
    return item;
  }
}

class HoverProvider implements vscode.HoverProvider {
  private _data: { key: string, content: string, tags: string, insert: string, hasRequest: false }[] = [];
  constructor(data: { key: string, content: string, tags: string, insert: string, hasRequest: false }[]) {
    this._data = data;
  }
  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    const text = document.getText(document.getWordRangeAtPosition(position));
    const obj = this._data.find(v => v.key === text);
    if (obj) {
      const contents = [`key ： ${obj.key}`];
      if (obj.content) {
        contents.push(`内容： ${obj.content}`);
      }
      if (obj.tags) {
        contents.push(`标签： ${obj.tags}`);
      }
      // contents.push(...obj?.description?.split('\n')?.filter(v => v) || []);
      return new vscode.Hover(contents);
    }
    return new vscode.Hover([]);
  }
}

class Intl {
  private _dir: string | null = null;
  private _tmp: Record<string, { key: string, content: string, tags: string, insert: string, hasRequest: false }> = {};
  private _loading = false;
  private _context;
  private _completionItemProvider: vscode.Disposable | undefined;
  private _hoverProvider: vscode.Disposable | undefined;
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.checkConfig(false);
  }
  checkConfig = (showWarn: boolean) => {
    let dir: string = vscode.workspace.getConfiguration('数数最强插件').get('国际化语言包路径') || '';
    dir = dir.trim();
    if (dir && !dir.endsWith('/')) {
      dir = `${dir}/`;
    }
    if (this._dir === dir) {
      return;
    }
    if (this._dir) {
      watch.unwatchTree(this._dir);
    }
    this._dir = dir;
    if (!this._dir) {
      if (showWarn) {
        vscode.window.showInformationMessage('【数数最强插件.国际化语言包路径】功能关闭');
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
        vscode.window.showInformationMessage('【数数最强插件.国际化语言包路径】配置路径不存在');
      }
      return;
    }
    if (showWarn) {
      vscode.window.showInformationMessage('【数数最强插件.国际化语言包路径】配置已经生效');
    }
    this._watchFile();
  };
  private _watchFile = () => {
    watch.watchTree(this._dir, (path: string) => {
      if (this._loading) {
        return;
      }
      this._loading = true;
      setTimeout(() => {
        this._readData();
        this._loading = false;
      }, 1500); // 1.5s后刷新数据
    });
  };
  private _readData = () => {
    if (!this._dir) {
      return;
    }
    this._tmp = {};
    fs.readdirSync(this._dir).forEach((fileName) => {
      if (fileName.startsWith('zh-CN')) {
        const tag = fileName.split('.json')[0].split('-')[2];
        const path = `${this._dir}${fileName}`;
        let obj: Record<string, string> = {};
        try {
          obj = JSON.parse(fs.readFileSync(path).toString());
        } catch { }
        Object.entries(obj).forEach(([key, content]) => {
          if (!this._tmp[key]) {
            const varStrs: string[] = [];
            content.replace(/\{.*?\}/g, (str: string) => {
              varStrs.push(str.substring(1, str.length - 1));
              return str;
            });
            this._tmp[key] = { key, content, tags: tag, insert: `formatMessage({ id: '${key}' }${varStrs.length > 0 ? ', { ' : ''}${varStrs.map(v => `${v}: ''`).join(', ')}${varStrs.length > 0 ? ' }' : ''})`, hasRequest: false };
          } else {
            this._tmp[key].tags += `,${tag}`;
          }
        });
      }
    });
    const data = Object.values(this._tmp);
    if (this._completionItemProvider) {
      this._completionItemProvider.dispose();
    }
    this._completionItemProvider = vscode.languages.registerCompletionItemProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact'], new CompletionItemProvider(data));
    this._context.subscriptions.push(this._completionItemProvider);
    if (this._hoverProvider) {
      this._hoverProvider.dispose();
    }
    this._hoverProvider = vscode.languages.registerHoverProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'json'], new HoverProvider(data));
    this._context.subscriptions.push(this._hoverProvider);
  };
}

export default Intl;