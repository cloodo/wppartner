import ffmpeg from "fluent-ffmpeg";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { config } from "../config";
import type { VideoSlide } from "../content/generator";

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT_SIZE = 56;
const BG_COLOR = "#1a1a2e";
const TEXT_COLOR = "#ffffff";
const ACCENT_COLOR = "#e94560";

export async function createVideo(
  slides: VideoSlide[],
  outputFilename: string
): Promise<string> {
  const outputDir = config.video.outputDir;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${outputFilename}.mp4`);
  const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);

  // Build filter complex for text slides over solid background
  const filterComplex = buildFilterComplex(slides);

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(`color=c=${BG_COLOR}:s=${WIDTH}x${HEIGHT}:d=${totalDuration}:r=30`)
      .inputFormat("lavfi")
      .complexFilter(filterComplex.filters, filterComplex.outputLabel)
      .outputOptions([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-t", totalDuration.toString(),
      ])
      .output(outputPath)
      .on("start", (cmd) => {
        console.log(`  FFmpeg command: ${cmd.substring(0, 200)}...`);
      })
      .on("end", () => {
        console.log(`  Video created: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`  FFmpeg error: ${err.message}`);
        reject(err);
      });

    command.run();
  });
}

function buildFilterComplex(slides: VideoSlide[]): {
  filters: string[];
  outputLabel: string;
} {
  const filters: string[] = [];
  let currentTime = 0;
  let prevLabel = "0:v";

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const startTime = currentTime;
    const endTime = currentTime + slide.duration;
    const outputLabel = `v${i}`;

    // Escape text for FFmpeg drawtext filter
    const escapedText = escapeFFmpegText(slide.text);

    // Title slide (first) gets accent color header bar
    if (i === 0) {
      filters.push(
        `[${prevLabel}]drawbox=x=0:y=${HEIGHT / 2 - 200}:w=${WIDTH}:h=8:c=${ACCENT_COLOR}:t=fill:enable='between(t,${startTime},${endTime})'[box${i}]`
      );
      filters.push(
        `[box${i}]drawtext=text='${escapedText}':fontsize=${FONT_SIZE + 10}:fontcolor=${TEXT_COLOR}:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startTime},${endTime})'[${outputLabel}]`
      );
    } else if (i === slides.length - 1) {
      // CTA slide gets accent background
      filters.push(
        `[${prevLabel}]drawbox=x=0:y=${HEIGHT / 2 - 80}:w=${WIDTH}:h=160:c=${ACCENT_COLOR}:t=fill:enable='between(t,${startTime},${endTime})'[box${i}]`
      );
      filters.push(
        `[box${i}]drawtext=text='${escapedText}':fontsize=${FONT_SIZE}:fontcolor=${TEXT_COLOR}:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startTime},${endTime})'[${outputLabel}]`
      );
    } else {
      // Regular content slide
      filters.push(
        `[${prevLabel}]drawtext=text='${escapedText}':fontsize=${FONT_SIZE}:fontcolor=${TEXT_COLOR}:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startTime},${endTime})'[${outputLabel}]`
      );
    }

    prevLabel = outputLabel;
    currentTime = endTime;
  }

  return { filters, outputLabel: prevLabel };
}

function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, "\\\\:")
    .replace(/%/g, "%%")
    .replace(/\n/g, " ");
}

export function checkFfmpegAvailable(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
