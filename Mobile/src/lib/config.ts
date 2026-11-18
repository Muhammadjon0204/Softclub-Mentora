/**
 * Where the API lives. Production by default; for local development point it at the docker API, for
 * example `EXPO_PUBLIC_API_URL=http://192.168.1.10:5050 npx expo start` (the phone must reach the Mac).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://tmsapi.softclub.tj').replace(/\/$/, '');

/** The site — for actions the app does not have yet (opened in the browser). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ravand.softclub.tj').replace(/\/$/, '');
