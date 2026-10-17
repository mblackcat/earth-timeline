import { act, fireEvent, render, screen } from "@testing-library/react";
import { DetailsCard } from "./DetailsCard";
import { NowPanel } from "./NowPanel";
import { EVENT_BY_ID } from "../../data/events";
import { jumpToEvent } from "../../state/actions";
import { startVisibilitySync, useFossilSitesStore } from "../../state/sceneStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { bindTimeStore } from "../../state/timeStore";
import { useViewStore } from "../../state/viewStore";
import { timeEngine } from "../../timeline/runtime";

let stop: () => void;
beforeEach(() => {
  timeEngine.pause();
  timeEngine.seek(68e6);
  useSettingsStore.setState({ showEventMarkers: true, showFossilSites: true });
  useSelectionStore.setState({ selectedEventId: null, selectedSpeciesId: null, detail: null });
  useFossilSitesStore.setState({
    loadState: "ready",
    error: null,
    data: {
      format: "ett-fossil-sites/1",
      sourceId: "pbdb",
      generated: "",
      note: "",
      species: { "tyrannosaurus-rex": { pbdbName: "Tyrannosaurus rex", filterMa: [72.2, 66], occurrences: 68, sites: [[-106, 47]] } },
    },
  });
  const unbind = bindTimeStore(timeEngine);
  const unsync = startVisibilitySync();
  stop = () => {
    unsync();
    unbind();
  };
});
afterEach(() => stop());

describe("NowPanel", () => {
  it("lists what is visible now and changes with time", () => {
    render(<NowPanel />);
    expect(screen.getByTestId("now-species-tyrannosaurus-rex")).toBeInTheDocument();
    expect(screen.getByTestId("now-event-end-cretaceous-extinction")).toBeInTheDocument();
    act(() => {
      timeEngine.seek(500e6);
    });
    expect(screen.queryByTestId("now-species-tyrannosaurus-rex")).toBeNull();
    expect(screen.getByTestId("now-species-trilobita")).toBeInTheDocument();
  });

  it("opens the species details from the list", () => {
    render(
      <>
        <NowPanel />
        <DetailsCard />
      </>,
    );
    fireEvent.click(screen.getByTestId("now-species-tyrannosaurus-rex"));
    const card = screen.getByTestId("details-card");
    expect(card).toHaveAttribute("data-kind", "species");
    expect(card).toHaveTextContent("霸王龙");
    expect(card).toHaveTextContent("1 个化石点（68 条 PBDB 记录");
    expect(card).toHaveTextContent("Paleobiology Database");
  });
});

describe("DetailsCard", () => {
  it("shows event time, evidence and queryable sources", () => {
    render(<DetailsCard />);
    act(() => useSelectionStore.getState().selectEvent("homo-sapiens"));
    expect(screen.getByTestId("detail-time")).toHaveTextContent("距今 315 ka（千年）（± 34 千年）");
    expect(screen.getByTestId("details-card")).toHaveTextContent("估计值");
    const link = screen.getByRole("link", { name: /Hublin/ });
    expect(link).toHaveAttribute("href", "https://doi.org/10.1038/nature22336");
    fireEvent.click(screen.getByTestId("details-close"));
    expect(screen.queryByTestId("details-card")).toBeNull();
  });

  it("closes the species card when the species leaves its time range", () => {
    render(<DetailsCard />);
    act(() => useSelectionStore.getState().selectSpecies("tyrannosaurus-rex"));
    expect(screen.getByTestId("details-card")).toBeInTheDocument();
    act(() => {
      timeEngine.seek(10e6);
    });
    expect(screen.queryByTestId("details-card")).toBeNull();
  });

  it("does not crash on unknown ids", () => {
    render(<DetailsCard />);
    act(() => useSelectionStore.setState({ selectedEventId: "nope", detail: "event" }));
    expect(screen.getByTestId("details-card")).toHaveTextContent("未找到事件数据");
  });
});

describe("jumpToEvent", () => {
  it("seeks, selects and flies the camera to located events", () => {
    jumpToEvent(EVENT_BY_ID["end-cretaceous-extinction"]!);
    expect(timeEngine.currentTimeYearsAgo).toBe(66e6);
    expect(useSelectionStore.getState().selectedEventId).toBe("end-cretaceous-extinction");
    expect(useViewStore.getState().command).toMatchObject({ kind: "focus", target: { lon: -89.5, lat: 21.4 } });
  });

  it("does not move the camera for global events", () => {
    const before = useViewStore.getState().command?.id;
    jumpToEvent(EVENT_BY_ID["end-permian-extinction"]!);
    expect(timeEngine.currentTimeYearsAgo).toBe(251.941e6);
    expect(useViewStore.getState().command?.id).toBe(before);
  });
});
