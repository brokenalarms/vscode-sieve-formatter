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

        const fullText = document.getText();
        const formattedText = formatDocument(fullText, indent);

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
