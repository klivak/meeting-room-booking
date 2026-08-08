import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  CalendarRange,
  Check,
  Clock3,
  Globe2,
  LockKeyhole,
  MousePointer2,
  Repeat2,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily: sans } = loadManrope("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "cyrillic"],
});
const { fontFamily: mono } = loadJetBrainsMono("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

const C = {
  ink: "#10261f",
  muted: "#65766f",
  faint: "#94a39d",
  jade: "#0d8f69",
  jadeBright: "#20c89a",
  mint: "#dff5ed",
  mintSoft: "#eef8f4",
  surface: "#ffffff",
  canvas: "#edf4f1",
  line: "#d8e3de",
  orange: "#d85b08",
};

const COPY = {
  uk: {
    intro: {
      kicker: "ПЕРЕГОВОРНІ",
      title: "Бронювання без зайвих повідомлень",
      chips: ["6 кімнат", "30 хв", "Europe/Kyiv"],
    },
    rooms: {
      kicker: "КІМНАТИ",
      title: "Знайди потрібну кімнату",
      text: "Поверх, місткість і вільний час — одразу на картці.",
      chips: ["2–12 місць", "вільна зараз"],
    },
    schedule: {
      kicker: "ТИЖНЕВА СІТКА",
      title: "Увесь тиждень перед очима",
      text: "30-хвилинні слоти, поточний час і зайняті проміжки.",
      days: "7 днів",
    },
    booking: {
      kicker: "БРОНЮВАННЯ",
      title: "Обери час. Додай назву.",
      text: "Система перевірить конфлікти, робочі години та тривалість.",
      chips: ["клік або протягування", "повторювати щотижня"],
    },
    mobile: {
      kicker: "МОБІЛЬНИЙ СЦЕНАРІЙ",
      title: "Так само зручно на телефоні",
      text: "Тапни слот, потягни маркер і розгорни форму, коли готовий.",
      chips: ["для сенсорних екранів", "30 хв — 4 год"],
    },
    trust: {
      kicker: "СПОКІЙ У КАЛЕНДАРІ",
      title: "Менше координації. Більше зустрічей.",
      cards: [
        {
          title: "Часовий пояс користувача",
          text: "Робочі години залишаються київськими.",
        },
        {
          title: "Чужі бронювання захищені",
          text: "Редагувати й скасовувати можна тільки свої.",
        },
        {
          title: "Жодних подвійних слотів",
          text: "Сервер зупиняє конфлікти навіть при одночасних запитах.",
        },
      ],
    },
    outro: ["Знайди кімнату.", "Обери час.", "Готово."],
  },
  en: {
    intro: {
      kicker: "MEETING ROOMS",
      title: "Booking without the back-and-forth",
      chips: ["6 rooms", "30 min", "Europe/Kyiv"],
    },
    rooms: {
      kicker: "ROOMS",
      title: "Find the right room",
      text: "Floor, capacity, and availability — all visible at a glance.",
      chips: ["2–12 seats", "live availability"],
    },
    schedule: {
      kicker: "WEEKLY SCHEDULE",
      title: "See the whole week",
      text: "30-minute slots, the current time, and every booking in one view.",
      days: "7 days",
    },
    booking: {
      kicker: "BOOKING",
      title: "Pick a time. Add a title.",
      text: "The system checks conflicts, working hours, and duration.",
      chips: ["click or drag", "repeat weekly"],
    },
    mobile: {
      kicker: "MOBILE EXPERIENCE",
      title: "Just as easy on your phone",
      text: "Tap a slot, drag the handle, and expand the form when you need it.",
      chips: ["touch-friendly", "30 min — 4 hr"],
    },
    trust: {
      kicker: "A CALMER CALENDAR",
      title: "Less coordination. More meetings.",
      cards: [
        {
          title: "Your local time zone",
          text: "Working hours always stay aligned with Kyiv.",
        },
        {
          title: "Bookings stay protected",
          text: "People can only edit or cancel their own bookings.",
        },
        {
          title: "No double bookings",
          text: "The server prevents conflicts, even when requests arrive together.",
        },
      ],
    },
    outro: ["Find a room.", "Choose a time.", "Done."],
  },
} as const;

export type PromoLanguage = keyof typeof COPY;
type PromoCopy = (typeof COPY)[PromoLanguage];

const ease = Easing.bezier(0.22, 1, 0.36, 1);

function GridBackdrop({ dark = false }: { dark?: boolean }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? "#0b1814" : C.canvas,
        backgroundImage: dark
          ? "linear-gradient(rgba(77,157,131,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(77,157,131,.08) 1px, transparent 1px)"
          : "linear-gradient(rgba(55,112,93,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(55,112,93,.07) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <AbsoluteFill
        style={{
          background: dark
            ? "radial-gradient(circle at 72% 28%, rgba(30,190,143,.17), transparent 34%), radial-gradient(circle at 22% 78%, rgba(13,143,105,.13), transparent 31%)"
            : "radial-gradient(circle at 70% 24%, rgba(37,188,143,.18), transparent 32%), radial-gradient(circle at 18% 80%, rgba(255,255,255,.95), transparent 35%)",
        }}
      />
    </AbsoluteFill>
  );
}

function LogoMark({ size = 68 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: size * 0.09,
        padding: size * 0.23,
        background: `linear-gradient(145deg, ${C.jadeBright}, ${C.jade})`,
        boxShadow: "0 18px 45px rgba(13,143,105,.26)",
      }}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={index}
          style={{ borderRadius: size * 0.045, background: "white" }}
        />
      ))}
    </div>
  );
}

function Kicker({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        color: dark ? "#78e9c3" : C.jade,
        fontFamily: mono,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: ".14em",
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 99,
          background: "currentColor",
        }}
      />
      {children}
    </div>
  );
}

function Scene({
  duration,
  dark = false,
  children,
}: {
  duration: number;
  dark?: boolean;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 16, duration - 18, duration],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: "hidden",
        fontFamily: sans,
        color: dark ? "white" : C.ink,
      }}
    >
      <GridBackdrop dark={dark} />
      {children}
    </AbsoluteFill>
  );
}

function BrowserFrame({ src, style }: { src: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.96)",
        border: "1px solid rgba(55,92,79,.18)",
        borderRadius: 28,
        overflow: "hidden",
        boxShadow:
          "0 40px 100px rgba(31,63,52,.23), 0 8px 25px rgba(31,63,52,.1)",
        ...style,
      }}
    >
      <div
        style={{
          height: 50,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 20px",
          borderBottom: `1px solid ${C.line}`,
          background: "#f9fbfa",
        }}
      >
        {["#ff735f", "#f4be4f", "#35bf74"].map((color) => (
          <span
            key={color}
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              background: color,
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 14,
            height: 22,
            width: 330,
            borderRadius: 99,
            background: "#edf2f0",
          }}
        />
      </div>
      <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
    </div>
  );
}

function PhoneFrame({ src, style }: { src: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: 360,
        height: 780,
        borderRadius: 52,
        padding: 12,
        background: "#12231d",
        boxShadow: "0 40px 90px rgba(3,19,13,.34)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          borderRadius: 41,
          overflow: "hidden",
          background: C.canvas,
        }}
      >
        <div
          style={{
            position: "absolute",
            zIndex: 3,
            top: 10,
            left: "50%",
            width: 105,
            height: 25,
            borderRadius: 99,
            background: "#12231d",
            transform: "translateX(-50%)",
          }}
        />
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}

function FeatureChip({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "15px 20px",
        borderRadius: 16,
        color: C.jade,
        background: C.mint,
        fontSize: 20,
        fontWeight: 700,
        boxShadow: "0 10px 25px rgba(13,143,105,.10)",
      }}
    >
      {icon}
      {children}
    </div>
  );
}

function IntroScene({ copy }: { copy: PromoCopy }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90, mass: 0.8 },
  });
  const words = interpolate(frame, [18, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <Scene duration={120} dark>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
        }}
      >
        <div
          style={{ transform: `scale(${0.7 + pop * 0.3})`, marginBottom: 42 }}
        >
          <LogoMark size={104} />
        </div>
        <Kicker dark>{copy.intro.kicker}</Kicker>
        <h1
          style={{
            margin: "25px 0 0",
            maxWidth: 1250,
            fontSize: 102,
            lineHeight: 1.02,
            letterSpacing: "-.055em",
            fontWeight: 800,
            opacity: words,
            transform: `translateY(${(1 - words) * 30}px)`,
          }}
        >
          {copy.intro.title}
        </h1>
        <div style={{ marginTop: 45, display: "flex", gap: 14 }}>
          {copy.intro.chips.map((item, index) => (
            <div
              key={item}
              style={{
                opacity: interpolate(
                  frame,
                  [48 + index * 7, 68 + index * 7],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
                border: "1px solid rgba(113,232,193,.28)",
                borderRadius: 999,
                padding: "12px 20px",
                color: "#b5c9c2",
                fontFamily: mono,
                fontSize: 18,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </Scene>
  );
}

function RoomsScene({
  copy,
  assetDirectory,
}: {
  copy: PromoCopy;
  assetDirectory: string;
}) {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 38], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const scale = interpolate(frame, [0, 180], [1.045, 1], {
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <Scene duration={180}>
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 120,
          width: 580,
          zIndex: 3,
        }}
      >
        <Kicker>{copy.rooms.kicker}</Kicker>
        <h2
          style={{
            margin: "26px 0 20px",
            fontSize: 72,
            lineHeight: 1.04,
            letterSpacing: "-.045em",
          }}
        >
          {copy.rooms.title}
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            color: C.muted,
            fontSize: 27,
            lineHeight: 1.45,
          }}
        >
          {copy.rooms.text}
        </p>
        <div style={{ marginTop: 34, display: "flex", gap: 12 }}>
          <FeatureChip icon={<UsersRound size={24} />}>
            {copy.rooms.chips[0]}
          </FeatureChip>
          <FeatureChip icon={<Check size={24} />}>
            {copy.rooms.chips[1]}
          </FeatureChip>
        </div>
      </div>
      <BrowserFrame
        src={`${assetDirectory}/rooms-desktop.png`}
        style={{
          position: "absolute",
          width: 1215,
          right: -105,
          top: 125 + rise,
          transform: `scale(${scale}) rotate(-1.2deg)`,
          transformOrigin: "center",
        }}
      />
    </Scene>
  );
}

function ScheduleScene({
  copy,
  assetDirectory,
}: {
  copy: PromoCopy;
  assetDirectory: string;
}) {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 210], [1.07, 1.015], {
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <Scene duration={210} dark>
      <div style={{ position: "absolute", left: 110, top: 82, zIndex: 4 }}>
        <Kicker dark>{copy.schedule.kicker}</Kicker>
        <h2
          style={{ margin: "20px 0 0", fontSize: 68, letterSpacing: "-.045em" }}
        >
          {copy.schedule.title}
        </h2>
        <p style={{ margin: "13px 0 0", color: "#afc0ba", fontSize: 25 }}>
          {copy.schedule.text}
        </p>
      </div>
      <BrowserFrame
        src={`${assetDirectory}/schedule-desktop.png`}
        style={{
          position: "absolute",
          left: 95,
          right: 95,
          top: 305,
          transform: `scale(${zoom})`,
          transformOrigin: "50% 25%",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 135,
          bottom: 70,
          display: "flex",
          gap: 12,
        }}
      >
        <FeatureChip icon={<Clock3 size={24} />}>09:00–19:00</FeatureChip>
        <FeatureChip icon={<CalendarRange size={24} />}>
          {copy.schedule.days}
        </FeatureChip>
      </div>
    </Scene>
  );
}

function BookingScene({
  copy,
  assetDirectory,
}: {
  copy: PromoCopy;
  assetDirectory: string;
}) {
  const frame = useCurrentFrame();
  const panelIn = spring({
    frame: frame - 15,
    fps: 30,
    config: { damping: 18, stiffness: 95 },
  });
  return (
    <Scene duration={210}>
      <BrowserFrame
        src={`${assetDirectory}/panel-desktop.png`}
        style={{
          position: "absolute",
          width: 1640,
          left: 140,
          top: 130,
          transform: `translateY(${(1 - panelIn) * 60}px) scale(${0.96 + panelIn * 0.04})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 90,
          zIndex: 4,
          padding: "22px 28px",
          background: "rgba(255,255,255,.94)",
          borderRadius: 22,
          boxShadow: "0 20px 50px rgba(31,63,52,.16)",
        }}
      >
        <Kicker>{copy.booking.kicker}</Kicker>
        <h2
          style={{
            margin: "16px 0 5px",
            fontSize: 54,
            letterSpacing: "-.04em",
          }}
        >
          {copy.booking.title}
        </h2>
        <p style={{ margin: 0, color: C.muted, fontSize: 22 }}>
          {copy.booking.text}
        </p>
      </div>
      <div
        style={{
          position: "absolute",
          right: 82,
          bottom: 70,
          zIndex: 4,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <FeatureChip icon={<MousePointer2 size={24} />}>
          {copy.booking.chips[0]}
        </FeatureChip>
        <FeatureChip icon={<Repeat2 size={24} />}>
          {copy.booking.chips[1]}
        </FeatureChip>
      </div>
    </Scene>
  );
}

function MobileScene({
  copy,
  assetDirectory,
}: {
  copy: PromoCopy;
  assetDirectory: string;
}) {
  const frame = useCurrentFrame();
  const left = spring({
    frame,
    fps: 30,
    config: { damping: 17, stiffness: 85 },
  });
  const right = spring({
    frame: frame - 20,
    fps: 30,
    config: { damping: 17, stiffness: 85 },
  });
  return (
    <Scene duration={180} dark>
      <div style={{ position: "absolute", left: 115, top: 170, width: 700 }}>
        <Kicker dark>{copy.mobile.kicker}</Kicker>
        <h2
          style={{
            margin: "25px 0 18px",
            fontSize: 76,
            lineHeight: 1.05,
            letterSpacing: "-.045em",
          }}
        >
          {copy.mobile.title}
        </h2>
        <p
          style={{
            margin: 0,
            width: 620,
            color: "#afc0ba",
            fontSize: 27,
            lineHeight: 1.45,
          }}
        >
          {copy.mobile.text}
        </p>
        <div style={{ marginTop: 38, display: "flex", gap: 14 }}>
          <FeatureChip icon={<Smartphone size={24} />}>
            {copy.mobile.chips[0]}
          </FeatureChip>
          <FeatureChip icon={<Clock3 size={24} />}>
            {copy.mobile.chips[1]}
          </FeatureChip>
        </div>
      </div>
      <PhoneFrame
        src={`${assetDirectory}/rooms-phone.png`}
        style={{
          position: "absolute",
          right: 465,
          top: 145,
          transform: `translateY(${(1 - left) * 120}px) rotate(-5deg)`,
        }}
      />
      <PhoneFrame
        src={`${assetDirectory}/panel-phone.png`}
        style={{
          position: "absolute",
          right: 95,
          top: 95,
          transform: `translateY(${(1 - right) * 130}px) rotate(4deg)`,
        }}
      />
    </Scene>
  );
}

function TrustScene({ copy }: { copy: PromoCopy }) {
  const frame = useCurrentFrame();
  const cards = [
    {
      icon: <Globe2 size={38} />,
      ...copy.trust.cards[0],
    },
    {
      icon: <ShieldCheck size={38} />,
      ...copy.trust.cards[1],
    },
    {
      icon: <LockKeyhole size={38} />,
      ...copy.trust.cards[2],
    },
  ];
  return (
    <Scene duration={150}>
      <div
        style={{
          position: "absolute",
          inset: "120px 110px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Kicker>{copy.trust.kicker}</Kicker>
        <h2
          style={{
            margin: "24px 0 55px",
            fontSize: 68,
            letterSpacing: "-.045em",
          }}
        >
          {copy.trust.title}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            width: "100%",
          }}
        >
          {cards.map((card, index) => {
            const reveal = spring({
              frame: frame - index * 10,
              fps: 30,
              config: { damping: 18, stiffness: 90 },
            });
            return (
              <div
                key={card.title}
                style={{
                  minHeight: 280,
                  padding: 38,
                  borderRadius: 26,
                  background: "rgba(255,255,255,.94)",
                  border: `1px solid ${C.line}`,
                  boxShadow: "0 24px 55px rgba(31,63,52,.12)",
                  opacity: reveal,
                  transform: `translateY(${(1 - reveal) * 45}px)`,
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 70,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 20,
                    color: C.jade,
                    background: C.mint,
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    margin: "25px 0 12px",
                    fontSize: 30,
                    lineHeight: 1.15,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: C.muted,
                    fontSize: 21,
                    lineHeight: 1.45,
                  }}
                >
                  {card.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Scene>
  );
}

function OutroScene({ copy }: { copy: PromoCopy }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 16, stiffness: 95 } });
  return (
    <Scene duration={120} dark>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              transform: `scale(${0.75 + mark * 0.25})`,
            }}
          >
            <LogoMark size={92} />
          </div>
          <div
            style={{
              marginTop: 36,
              display: "flex",
              justifyContent: "center",
              gap: 18,
              alignItems: "center",
              fontSize: 70,
              fontWeight: 800,
              letterSpacing: "-.045em",
            }}
          >
            {copy.outro.map((item, index) => (
              <span
                key={item}
                style={{
                  opacity: interpolate(
                    frame,
                    [18 + index * 12, 34 + index * 12],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  ),
                  color: index === 2 ? "#69e2b9" : "white",
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <p
            style={{
              margin: "28px 0 0",
              color: "#a9bbb5",
              fontFamily: mono,
              fontSize: 22,
            }}
          >
            meeting-room-booking · Europe/Kyiv
          </p>
        </div>
      </div>
    </Scene>
  );
}

export function MeetingRoomsPromo({
  language = "uk",
}: {
  language?: PromoLanguage;
}) {
  const copy = COPY[language];
  const assetDirectory = `app/${language}`;

  return (
    <AbsoluteFill style={{ background: "#0b1814" }}>
      <Audio
        src={staticFile("music.mp3")}
        volume={(frame) =>
          interpolate(frame, [0, 30, 1020, 1079], [0, 0.22, 0.22, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Sequence from={0} durationInFrames={120}>
        <IntroScene copy={copy} />
      </Sequence>
      <Sequence from={105} durationInFrames={180}>
        <RoomsScene copy={copy} assetDirectory={assetDirectory} />
      </Sequence>
      <Sequence from={270} durationInFrames={210}>
        <ScheduleScene copy={copy} assetDirectory={assetDirectory} />
      </Sequence>
      <Sequence from={465} durationInFrames={210}>
        <BookingScene copy={copy} assetDirectory={assetDirectory} />
      </Sequence>
      <Sequence from={660} durationInFrames={180}>
        <MobileScene copy={copy} assetDirectory={assetDirectory} />
      </Sequence>
      <Sequence from={825} durationInFrames={150}>
        <TrustScene copy={copy} />
      </Sequence>
      <Sequence from={960} durationInFrames={120}>
        <OutroScene copy={copy} />
      </Sequence>
    </AbsoluteFill>
  );
}
