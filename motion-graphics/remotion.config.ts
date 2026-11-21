import {Config} from '@remotion/cli/config';

// D-249: Render lokal/server sendiri — tidak ada AWS Lambda.
// `Config.setChromiumOpenGlRenderer('angle')` dipakai hanya kalau butuh WebGL;
// default 'swangle' (software) sudah cukup untuk komposisi 2D kita & lebih
// stabil di server tanpa GPU.
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
