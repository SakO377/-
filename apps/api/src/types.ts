import type { StaffRole } from "@school-harness/shared";

export interface Env {
  DB: D1Database;
  LINE_FREE_PUSH_QUOTA: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  /** LINE Login (LIFF) チャネルID。IDトークン検証の audience として使用する。 */
  LIFF_CHANNEL_ID: string;
  /** CORSで許可するオリジン(カンマ区切り)。未設定または "*" で全オリジン許可。 */
  ALLOWED_ORIGINS?: string;
  /** "true" のときだけ /api/demo/session を有効化する(体験用デモ環境専用)。 */
  DEMO_MODE?: string;
  /**
   * 管理APIへアクセスできる送信元IPの許可リスト(カンマ区切り)。
   * 未設定/空 なら制限なし。設定すると、リストにないIPからの /api/* は 403 になる
   * (体験用デモの /api/demo は対象外)。
   */
  ADMIN_IP_ALLOWLIST?: string;
}

export interface AuthedStaff {
  id: string;
  name: string;
  role: StaffRole;
}

export interface Variables {
  staff: AuthedStaff;
}
