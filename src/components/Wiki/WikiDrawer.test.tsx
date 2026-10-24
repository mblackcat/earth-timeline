import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DetailsCard } from "../Scene/DetailsCard";
import { TopBar } from "../TopBar/TopBar";
import { WikiDrawer } from "./WikiDrawer";
import { useSelectionStore } from "../../state/selectionStore";
import { bindTimeStore, useTimeStore } from "../../state/timeStore";
import { useWikiStore } from "../../state/wikiStore";
import { timeEngine } from "../../timeline/runtime";

// jsdom 没有 WebGL：展台的 Canvas 换成占位
vi.mock("@react-three/fiber", async (orig) => ({
  ...(await orig<typeof import("@react-three/fiber")>()),
  Canvas: () => <div data-testid="wiki-canvas" />,
}));

let unbind: () => void;
beforeEach(() => {
  timeEngine.pause();
  timeEngine.seek(68e6);
  unbind = bindTimeStore(timeEngine);
  useWikiStore.setState({ open: false, speciesId: null });
  useSelectionStore.setState({ selectedEventId: null, selectedSpeciesId: null, detail: null, specimenId: null });
});
afterEach(() => unbind());

describe("WikiDrawer", () => {
  it("opens from the top bar and closes via the scrim and Escape", () => {
    render(
      <>
        <TopBar />
        <WikiDrawer />
      </>,
    );
    fireEvent.click(screen.getByTestId("btn-wiki"));
    expect(screen.getByTestId("wiki-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("wiki-canvas")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wiki-scrim"));
    expect(screen.queryByTestId("wiki-drawer")).toBeNull();
    fireEvent.click(screen.getByTestId("btn-wiki"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("wiki-drawer")).toBeNull();
  });

  it("shows a structured article for the species picked in the tree", () => {
    render(<WikiDrawer />);
    act(() => useWikiStore.getState().openWiki("trilobita"));
    // 所在分支自动展开
    fireEvent.click(screen.getByTestId("wiki-node-reptiles"));
    fireEvent.click(screen.getByTestId("wiki-node-dinosaurs"));
    fireEvent.click(screen.getByTestId("wiki-node-theropods"));
    fireEvent.click(screen.getByTestId("wiki-species-tyrannosaurus-rex"));
    const article = screen.getByTestId("wiki-article");
    expect(article).toHaveAttribute("data-species", "tyrannosaurus-rex");
    expect(article).toHaveTextContent("爬行类 / 恐龙 / 兽脚类");
    const facts = within(screen.getByTestId("wiki-facts"));
    expect(facts.getByText("Tyrannosaurus rex")).toBeInTheDocument();
    expect(facts.getByText("白垩纪")).toBeInTheDocument();
    for (const s of ["overview", "anatomy", "ecology", "discovery", "significance", "facts", "evidence", "sources"]) {
      expect(article.querySelector(`[data-section="${s}"]`), s).not.toBeNull();
    }
    expect(screen.getByTestId("wiki-species-tyrannosaurus-rex")).toHaveAttribute("aria-current", "true");
  });

  it("filters the tree by name or scientific name", () => {
    render(<WikiDrawer />);
    act(() => useWikiStore.getState().openWiki());
    fireEvent.change(screen.getByTestId("wiki-search"), { target: { value: "smilodon" } });
    expect(screen.getByTestId("wiki-species-smilodon")).toBeInTheDocument();
    expect(screen.queryByTestId("wiki-species-trilobita")).toBeNull();
    fireEvent.change(screen.getByTestId("wiki-search"), { target: { value: "三叶虫" } });
    expect(screen.getByTestId("wiki-species-trilobita")).toBeInTheDocument();
  });

  it("jumps the timeline to the species and selects it on the map", () => {
    render(<WikiDrawer />);
    act(() => useWikiStore.getState().openWiki("trilobita"));
    fireEvent.click(screen.getByTestId("wiki-jump"));
    const t = useTimeStore.getState().currentTimeYearsAgo;
    expect(t).toBeLessThan(521e6);
    expect(t).toBeGreaterThan(251e6);
    expect(useSelectionStore.getState().selectedSpeciesId).toBe("trilobita");
    expect(useWikiStore.getState().open).toBe(false);
  });

  it("opens from the map details card at that species", () => {
    render(
      <>
        <DetailsCard />
        <WikiDrawer />
      </>,
    );
    act(() => useSelectionStore.getState().selectSpecies("tyrannosaurus-rex"));
    fireEvent.click(screen.getByTestId("detail-wiki"));
    expect(screen.getByTestId("wiki-article")).toHaveAttribute("data-species", "tyrannosaurus-rex");
  });
});
