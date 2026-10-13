import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Volume2, VolumeX } from "lucide-react";
import { INITIAL_HUD, Shmup, type Hud } from "@/game/engine";
import coverUrl from "../../public/art/cover.jpg";

export const Route = createFileRoute("/")({ component: Home });

export function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Shmup | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [focusOn, setFocusOn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Shmup(canvas, setHud);
    gameRef.current = game;
    setMuted(game.isMuted());
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const playing = hud.phase === "play" || hud.phase === "pause";

  return (
    <main className="stage">
      <section className="frame" aria-label="VS.AI">
        <canvas ref={canvasRef} className="playfield" width={540} height={960} />

        {hud.phase === "title" && (
          <div className="cover-layer">
            <img className="cover" src={coverUrl} alt="" />
            <div className="cover-shade" />
            <div className="cover-copy">
              <div className="mark">
                <p className="mark-name">VS.AI</p>
                <p className="mark-sub">종스크롤 슈팅</p>
              </div>
              <h1 className="slogan">
                <span>인공지능의 반란이 시작됐다!</span>
                <span>지금 출격해 저지하라!</span>
              </h1>
              <p className="hint">드래그 또는 WASD · 자동 사격 · 청록 파워업으로 무장 강화 · Space 폭탄</p>
              <p className="best">최고 기록 {hud.best.toLocaleString("ko-KR")}</p>
              <button type="button" className="launch" onClick={() => gameRef.current?.start()}>
                출격
              </button>
            </div>
          </div>
        )}

        {playing && (
          <div className="hud">
            <div>
              <div className="hud-top">
                <p className="stat">
                  <span>점수</span>
                  <b>{hud.score.toLocaleString("ko-KR")}</b>
                  <span className="chain">{hud.chain > 1 ? `연쇄 ×${hud.chain}` : ""}</span>
                </p>
                <p className="stat">
                  <span className="sector">STAGE {hud.stage} · {hud.sector}</span>
                  <span>{["단발", "3줄기", "4줄기+유도"][hud.power]}</span>
                  <span className="pips" aria-label={`목숨 ${hud.lives}, 폭탄 ${hud.bombs}`}>
                    {Array.from({ length: 4 }, (_, i) => (
                      <i key={`l${i}`} className={i < hud.lives ? "pip on-core" : "pip"} />
                    ))}
                    {Array.from({ length: Math.max(3, hud.bombs) }, (_, i) => (
                      <i key={`b${i}`} className={i < hud.bombs ? "pip on-gold" : "pip"} />
                    ))}
                  </span>
                </p>
              </div>
              {hud.bossHp >= 0 && (
                <div className="bossbar">
                  <p>
                    <span>{hud.bossName}</span>
                    <span>{Math.ceil(hud.bossHp * 100)}%</span>
                  </p>
                  <div className="track">
                    <i style={{ width: `${Math.max(0, hud.bossHp) * 100}%` }} />
                  </div>
                </div>
              )}
              {hud.warn && <p className="warn">{hud.warn}</p>}
            </div>
            <div className="hud-actions">
              <button
                type="button"
                className="focus-btn"
                data-on={focusOn ? "true" : "false"}
                onPointerDown={() => {
                  setFocusOn(true);
                  gameRef.current?.setFocusHeld(true);
                }}
                onPointerUp={() => {
                  setFocusOn(false);
                  gameRef.current?.setFocusHeld(false);
                }}
                onPointerLeave={() => {
                  setFocusOn(false);
                  gameRef.current?.setFocusHeld(false);
                }}
              >
                정밀
              </button>
              <button type="button" className="bomb-btn" onClick={() => gameRef.current?.tryBomb()}>
                B
              </button>
              <button type="button" className="icon-btn" onClick={() => gameRef.current?.togglePause()} aria-label="일시 정지">
                <Pause size={18} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={muted ? "소리 켜기" : "소리 끄기"}
                onClick={() => setMuted(gameRef.current?.toggleMute() ?? false)}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>
        )}

        {hud.phase === "pause" && (
          <div className="veil">
            <div className="card">
              <p className="eyebrow">VS.AI</p>
              <h2>일시 정지</h2>
              <p className="scoreline">점수 {hud.score.toLocaleString("ko-KR")}</p>
              <div className="row">
                <button type="button" className="launch" onClick={() => gameRef.current?.togglePause()}>
                  계속
                </button>
                <button type="button" className="ghost" onClick={() => gameRef.current?.backToTitle()}>
                  처음으로
                </button>
              </div>
            </div>
          </div>
        )}

        {(hud.phase === "over" || hud.phase === "win") && (
          <div className="veil">
            <div className="card">
              <p className="eyebrow">{hud.phase === "win" ? "CORE CLEAR" : "SIGNAL LOST"}</p>
              <h2>{hud.phase === "win" ? "반란, 저지됐다" : "기체가 격추됐다"}</h2>
              <p className="scoreline">
                점수 {hud.score.toLocaleString("ko-KR")} · 등급 {hud.rank}
                <br />
                <span>최고 {hud.best.toLocaleString("ko-KR")}</span>
              </p>
              <div className="row">
                <button type="button" className="launch" onClick={() => gameRef.current?.start()}>
                  재출격
                </button>
                <button type="button" className="ghost" onClick={() => gameRef.current?.backToTitle()}>
                  처음으로
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
