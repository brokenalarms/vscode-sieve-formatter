import * as vscode from 'vscode';


function removeTrailingCommas(text: string): string {
  // Match a comma followed by any whitespace or newlines, then a closing bracket
  const listRegex = /",([\s\r\n]*(\)|\]))/g;
  return text.replace(listRegex, '"$1');
}

// Deactivate the extension
export function deactivate() { }

export function activate(context: vscode.ExtensionContext) {

  // Register a formatting provider for Sieve files
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('sieve', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];

        // Example: Format the entire document by replacing content
        const fullText = document.getText();
        const formattedText = removeTrailingCommas(fullText);

        edits.push(
          vscode.TextEdit.replace(
            new vscode.Range(
              document.positionAt(0),
              document.positionAt(fullText.length)
            ),
            formattedText
          )
        );

        return edits;
      }
    })
  );
}