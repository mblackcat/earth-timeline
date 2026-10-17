import { act, render, screen } from "@testing-library/react";
import { GeographyCaption } from "./GeographyCaption";
import { useGeographyStore, useReferenceCoastlineStore } from "../../state/geographyStore";
import { useSettingsStore } from "../../state/settingsStore";

describe("GeographyCaption", () => {
  beforeEach(() => {
    useSettingsStore.setState({ showOutlines: true, showModernReference: true });
    useReferenceCoastlineStore.setState({ outlines: [[[0, 0], [1, 1]]] });
    useGeographyStore.setState({ status: "missing", message: "该时期暂无古地理重建数据", slice: null, loadState: "idle", error: null, outlines: null });
  });

  it("explains the modern reference coastline in deep time, and hides the note when switched off", () => {
    render(<GeographyCaption />);
    expect(screen.getByTestId("geo-reference")).toHaveTextContent("不代表当时的海陆分布");
    act(() => useSettingsStore.setState({ showModernReference: false }));
    expect(screen.queryByTestId("geo-reference")).toBeNull();
  });
});
