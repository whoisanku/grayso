import React from "react";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

import { type ReactionIconName } from "@/lib/reactions";

type ReactionIconProps = {
  name: ReactionIconName;
  size?: number;
};

function LikeReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect
        x={15}
        y={45}
        width={20}
        height={45}
        rx={6}
        fill="#BFDBFE"
        stroke="#1E3A8A"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path
        d="M 35 45 C 35 45 40 35 40 25 C 40 15 55 15 55 25 C 55 35 50 45 50 45 L 70 45 C 80 45 85 55 80 65 L 75 80 C 70 90 60 90 50 90 L 35 90 Z"
        fill="#3B82F6"
        stroke="#1E3A8A"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Line
        x1={80}
        y1={58}
        x2={50}
        y2={58}
        stroke="#1E3A8A"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Line
        x1={77}
        y1={70}
        x2={50}
        y2={70}
        stroke="#1E3A8A"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Line
        x1={74}
        y1={80}
        x2={50}
        y2={80}
        stroke="#1E3A8A"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function DislikeReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect
        x={15}
        y={10}
        width={20}
        height={45}
        rx={6}
        fill="#FECACA"
        stroke="#7F1D1D"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path
        d="M 35 55 C 35 55 40 65 40 75 C 40 85 55 85 55 75 C 55 65 50 55 50 55 L 70 55 C 80 55 85 45 80 35 L 75 20 C 70 10 60 10 50 10 L 35 10 Z"
        fill="#EF4444"
        stroke="#7F1D1D"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Line
        x1={80}
        y1={42}
        x2={50}
        y2={42}
        stroke="#7F1D1D"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Line
        x1={77}
        y1={30}
        x2={50}
        y2={30}
        stroke="#7F1D1D"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Line
        x1={74}
        y1={20}
        x2={50}
        y2={20}
        stroke="#7F1D1D"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function HeartReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M 50 88 C 50 88 10 55 10 30 C 10 10 35 10 50 25 C 65 10 90 10 90 30 C 90 55 50 88 50 88 Z"
        fill="#EF4444"
        stroke="#991B1B"
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WowReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill="#FACC15" stroke="#A16207" strokeWidth={4} />
      <Ellipse cx={35} cy={38} rx={5} ry={8} fill="#422006" />
      <Ellipse cx={65} cy={38} rx={5} ry={8} fill="#422006" />
      <Ellipse cx={50} cy={65} rx={10} ry={14} fill="#422006" />
    </Svg>
  );
}

function LaughReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill="#FACC15" stroke="#A16207" strokeWidth={4} />
      <Path
        d="M 28 38 Q 35 30 42 38"
        stroke="#422006"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 58 38 Q 65 30 72 38"
        stroke="#422006"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 30 55 C 30 85 70 85 70 55 Z"
        fill="#422006"
        stroke="#422006"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M 25 45 C 15 55 18 65 25 65 C 32 65 35 55 25 45 Z"
        fill="#60A5FA"
        stroke="#1E3A8A"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M 75 45 C 65 55 68 65 75 65 C 82 65 85 55 75 45 Z"
        fill="#60A5FA"
        stroke="#1E3A8A"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AngryReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill="#F87171" stroke="#991B1B" strokeWidth={4} />
      <Path d="M 25 35 L 45 45" stroke="#450A0A" strokeWidth={5} strokeLinecap="round" />
      <Path d="M 75 35 L 55 45" stroke="#450A0A" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={35} cy={50} r={5} fill="#450A0A" />
      <Circle cx={65} cy={50} r={5} fill="#450A0A" />
      <Path
        d="M 35 70 Q 50 66 65 70"
        stroke="#450A0A"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function SadReactionIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill="#FACC15" stroke="#A16207" strokeWidth={4} />
      <Path
        d="M 25 35 Q 35 30 45 40"
        stroke="#422006"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 75 35 Q 65 30 55 40"
        stroke="#422006"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={35} cy={48} r={5} fill="#422006" />
      <Circle cx={65} cy={48} r={5} fill="#422006" />
      <Path
        d="M 35 70 Q 50 60 65 70"
        stroke="#422006"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 65 55 C 55 70 60 80 65 80 C 70 80 75 70 65 55 Z"
        fill="#60A5FA"
        stroke="#1E3A8A"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReactionIcon({ name, size = 20 }: ReactionIconProps) {
  if (name === "like") {
    return <LikeReactionIcon size={size} />;
  }

  if (name === "dislike") {
    return <DislikeReactionIcon size={size} />;
  }

  if (name === "heart") {
    return <HeartReactionIcon size={size} />;
  }

  if (name === "wow") {
    return <WowReactionIcon size={size} />;
  }

  if (name === "laugh") {
    return <LaughReactionIcon size={size} />;
  }

  if (name === "angry") {
    return <AngryReactionIcon size={size} />;
  }

  return <SadReactionIcon size={size} />;
}
