// 撮影した写真の保存。
// カメラが撮った直後の写真は「キャッシュ」(OSが勝手に消してよい場所)にあるため、
// 記録として残す写真は document ディレクトリ(消えない場所)へ移動する。
// 記録にはファイル名だけを保存する(フォルダのフルパスはアプリ更新で変わることがあるため)。

import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

/** 撮影直後の写真を保存領域へ移し、保存したファイル名を返す */
export async function persistPhoto(tempUri: string): Promise<string> {
  photosDir.create({ intermediates: true, idempotent: true });
  const fileName = `${Date.now()}.jpg`;
  const source = new File(tempUri);
  await source.move(new File(photosDir, fileName));
  return fileName;
}

/** 保存済みファイル名 → 画像表示に使えるURI */
export function photoUri(fileName: string): string {
  return new File(photosDir, fileName).uri;
}
