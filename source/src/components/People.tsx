import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useMemo, useState } from "react";
import { UserRound, ChevronDown, ChevronUp } from "lucide-react";
import type { Item } from "../types/emby";
import type { EmbyClient } from "../api/client";
import SectionHeader from "./SectionHeader";
import Tooltip from "./Tooltip";

type Person = NonNullable<Item["People"]>[number];
const professions: Record<string, string> = {
  get Actor() {
    return t("library.actor");
  },
  get Director() {
    return t("library.director");
  },
  get Writer() {
    return t("library.writer");
  },
  get Producer() {
    return t("library.producer");
  },
  get Composer() {
    return t("library.composer");
  },
  get GuestStar() {
    return t("library.guest_star");
  },
  get VoiceActor() {
    return t("library.voice_actor");
  },
};
export function personItem(person: Person): Item {
  return {
    Id: person.Id,
    Name: person.Name,
    Type: "Person",
    ImageTags: person.PrimaryImageTag
      ? { Primary: person.PrimaryImageTag }
      : undefined,
  };
}
function PersonArt({ person, api }: { person: Item; api: EmbyClient | null }) {
  useI18n();

  const src = api?.image(person, false, 160);
  const [failed, setFailed] = useState("");
  return (
    <div className="person-art">
      {src && failed !== src ? (
        <img
          src={src}
          alt={person.Name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onError={() => setFailed(src)}
        />
      ) : (
        <UserRound aria-hidden="true" size={34} />
      )}
    </div>
  );
}
export function Cast({
  people,
  api,
  onPerson,
}: {
  people: Person[];
  api: EmbyClient | null;
  onPerson: (item: Item) => void;
}) {
  useI18n();

  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className="cast cast-section"
      aria-label={t("library.cast_and_crew")}
    >
      <SectionHeader
        className="cast-heading"
        title={t("library.cast_and_crew")}
        level={3}
      >
        {people.length > 8 && (
          <button
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? t("library.show_less_2")
              : t("library.view_all_3", { p0: people.length })}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </SectionHeader>
      <div className={expanded ? "cast-grid expanded" : "cast-grid"}>
        {(expanded ? people : people.slice(0, 8)).map((person, index) => {
          const item = personItem(person);
          const bilingual =
            /^(.*[\u3400-\u9fff].*?)\s*[（(]([A-Za-z][^()（）]*)[）)]\s*$/.exec(
              person.Name,
            );
          const name = bilingual?.[1].trim() || person.Name;
          const original = person.OriginalName || bilingual?.[2].trim();
          const role =
            person.Role ||
            professions[person.Type || ""] ||
            person.Type ||
            t("library.cast_member");
          return (
            <Tooltip
              key={`${person.Id}-${index}`}
              text={[
                person.Name,
                original && original !== person.Name ? original : "",
                role,
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <button
                className="cast-person"
                key={`${person.Id}-${index}`}
                disabled={!person.Id}
                aria-label={t("library.view_person", { p0: person.Name })}
                onClick={() => onPerson(item)}
              >
                <PersonArt person={item} api={api} />
                <strong title={person.Name}>{name}</strong>
                <small
                  title={
                    person.Role || professions[person.Type || ""] || person.Type
                  }
                >
                  {role}
                </small>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
export function plainOverview(value: string) {
  const plain = value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  const document = new DOMParser().parseFromString(plain, "text/html");
  document
    .querySelectorAll("script,style")
    .forEach((element) => element.remove());
  return (document.body.textContent || "").trim();
}
export default function PersonDetail({
  item,
  api,
}: {
  item: Item;
  api: EmbyClient | null;
}) {
  useI18n();

  const [expanded, setExpanded] = useState(false);
  const overview = useMemo(
    () => plainOverview(item.Overview || ""),
    [item.Overview],
  );
  return (
    <section className="person-detail" aria-label={t("library.person_details")}>
      <PersonArt person={item} api={api} />
      <div className="person-description">
        <span className="person-eyebrow">{t("library.cast_member")}</span>
        <h1>{item.Name}</h1>
        <h3>{t("library.biography")}</h3>
        <p
          className={
            expanded || overview.length <= 260
              ? "person-biography expanded"
              : "person-biography"
          }
        >
          {overview || t("library.no_biography_available_from_the_server")}
        </p>
        {overview.length > 260 && (
          <button
            className="biography-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? t("library.show_less") : t("library.show_more")}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>
    </section>
  );
}
