import * as vscode from 'vscode';
import { formatDocument } from './formatter';

export function deactivate() { }

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('sieve', {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
      ): vscode.TextEdit[] {
        const indent = options.insertSpaces
          ? ' '.repeat(options.tabSize)
          : '\t';

        const config = vscode.workspace.getConfiguration('sieve.formatter');
        const expandLists = config.get<boolean>('expandLists', true);
        const alwaysExpandRequire = config.get<boolean>('alwaysExpandRequire', false);
        const indentBlocksSetting = config.get<boolean>('indentBlocks', true);
        const joinElsifElseSetting = config.get<boolean>('joinElsifElse', true);
        const normalizeBlankLinesSetting = config.get<boolean>('normalizeBlankLines', true);
        const sortRequireSetting = config.get<boolean>('sortRequire', false);

        const fullText = document.getText();
        const formattedText = formatDocument(fullText, {
          indent,
          expandLists,
          alwaysExpandRequire,
          indentBlocks: indentBlocksSetting,
          joinElsifElse: joinElsifElseSetting,
          normalizeBlankLines: normalizeBlankLinesSetting,
          sortRequire: sortRequireSetting,
        });

        if (formattedText === fullText) {
          return [];
        }

        return [
          vscode.TextEdit.replace(
            new vscode.Range(
              document.positionAt(0),
              document.positionAt(fullText.length)
            ),
            formattedText
          )
        ];
      }
    })
  );
}
