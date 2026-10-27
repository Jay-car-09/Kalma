// Writes a CSV to the cache folder and opens the phone's share sheet.
// The file and sharing libraries load only when the user exports, so they can never affect
// app startup (lesson from the Phase 1E Android crash).

export async function shareCsv(fileName: string, content: string, dialogTitle: string): Promise<void> {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content); // UTF-8; the content starts with a BOM for Excel

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle,
  });
}
