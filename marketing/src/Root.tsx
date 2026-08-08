import { Composition } from "remotion";

import { MeetingRoomsPromo } from "./MeetingRoomsPromo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="MeetingRoomsPromoUk"
      component={MeetingRoomsPromo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ language: "uk" }}
    />
    <Composition
      id="MeetingRoomsPromoEn"
      component={MeetingRoomsPromo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ language: "en" }}
    />
  </>
);
