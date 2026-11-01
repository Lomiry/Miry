import { Film, Subtitles, Volume2 } from "lucide-react";
import type { MediaSource } from "../types/emby";
import { privateText } from "../privacy";
import { t } from "../i18n/core";
import Select from "./Select";

export default function PlaybackChoices({
  sources,
  source,
  sourceId,
  audio,
  subtitle,
  busy,
  onSource,
  onAudio,
  onSubtitle,
}: {
  sources: MediaSource[];
  source?: MediaSource;
  sourceId: string;
  audio: string;
  subtitle: string;
  busy: boolean;
  onSource: (id: string) => void;
  onAudio: (index: string) => void;
  onSubtitle: (index: string) => void;
}) {
  const audios = source?.MediaStreams?.filter((s) => s.Type === "Audio") || [];
  const subtitles =
    source?.MediaStreams?.filter((s) => s.Type === "Subtitle") || [];
  return (
    <fieldset className="playback-choices" aria-busy={busy}>
      <legend>{t("detail.playback_choices")}</legend>
      <label>
        <span>
          <Film size={17} />
          {t("detail.source")}
        </span>
        <Select
          aria-label={t("detail.source")}
          value={sourceId}
          disabled={busy || !sources.length}
          onChange={(e) => onSource(e.target.value)}
        >
          <option value="">
            {t("detail.auto_source")}
            {source
              ? ` · ${privateText(source.Name || source.Container || t("player.video_version"))}`
              : ""}
          </option>
          {sources.map((s) => (
            <option key={s.Id} value={s.Id}>
              {privateText(s.Name || s.Container || t("player.video_version"))}
              {s.MediaStreams?.find((v) => v.Type === "Video")?.Height
                ? ` · ${s.MediaStreams.find((v) => v.Type === "Video")!.Height}p`
                : ""}
              {s.Bitrate ? ` · ${(s.Bitrate / 1000000).toFixed(1)} Mbps` : ""}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span>
          <Subtitles size={17} />
          {t("detail.subtitle")}
        </span>
        <Select
          aria-label={t("detail.subtitle")}
          disabled={busy || !subtitles.length}
          value={subtitle}
          onChange={(e) => onSubtitle(e.target.value)}
        >
          <option value="">
            {subtitles.length
              ? t("detail.follow_preferences")
              : t("detail.no_tracks")}
          </option>
          <option value="-1">{t("detail.subtitles_off")}</option>
          {subtitles.map((s) => (
            <option key={s.Index} value={s.Index}>
              {s.DisplayTitle || s.Language || s.Codec || String(s.Index + 1)}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span>
          <Volume2 size={17} />
          {t("detail.audio")}
        </span>
        <Select
          aria-label={t("detail.audio")}
          disabled={busy || !audios.length}
          value={audio}
          onChange={(e) => onAudio(e.target.value)}
        >
          <option value="">
            {audios.length
              ? t("detail.follow_preferences")
              : t("detail.no_tracks")}
          </option>
          {audios.map((s) => (
            <option key={s.Index} value={s.Index}>
              {s.DisplayTitle || s.Language || s.Codec || String(s.Index + 1)}
            </option>
          ))}
        </Select>
      </label>
      <p className="playback-choice-hint" role="status">
        {busy
          ? t("player.preparing_playback")
          : !sources.length
            ? t("detail.no_source_metadata")
            : sourceId || audio || subtitle
              ? t("detail.selection_ready")
              : t("detail.auto_source_hint")}
      </p>
    </fieldset>
  );
}
