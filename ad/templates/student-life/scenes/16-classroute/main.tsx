/** @jsxRuntime classic */
/** @jsx React.createElement */
import { React } from '@fourier-video/sdk';
import {
  Canvas,
  defineProject,
  Project,
  ReactLayer,
  Video,
  Timeline,
} from '@fourier-video/sdk/project';
// 修改画面后运行 ad/scripts/render.py 更新本镜预渲染文件。
const USE_RENDERED_CLIPS = true;
export default defineProject(
  <Project id="njust-16-classroute" version="1.0" audioSampleRate={48000}>
    <Canvas
      width={1920}
      height={1080}
      fps={60}
      background="#f5f5f7"
      colorSpace="sRGB"
    />
    <Timeline>
      {USE_RENDERED_CLIPS ? (
        <Video
          id="visual"
          at="0f"
          duration="240f"
          src="rendered.mp4"
          sourceIn="0f"
          fit="contain"
          audio={false}
          x={960}
          y={540}
          width={1920}
          height={1080}
          layer={1}
        />
      ) : (
        <ReactLayer
          id="visual"
          at="0f"
          duration="240f"
          component="Visual.tsx"
          x={960}
          y={540}
          width={1920}
          height={1080}
          layer={1}
        />
      )}
    </Timeline>
  </Project>,
);
