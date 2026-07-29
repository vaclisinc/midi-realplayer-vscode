export interface ViewWindow {
  start: number;
  end: number;
}

export function resetViewWindowToStart(
  viewStart: number,
  viewEnd: number,
  duration: number
): ViewWindow {
  const boundedDuration = Math.max(0, duration);
  const windowDuration = Math.min(
    Math.max(0, viewEnd - viewStart),
    boundedDuration
  );
  return {
    start: 0,
    end: windowDuration
  };
}

export function centerViewWindow(
  time: number,
  viewStart: number,
  viewEnd: number,
  duration: number
): ViewWindow {
  const boundedDuration = Math.max(0, duration);
  const windowDuration = Math.min(
    Math.max(0, viewEnd - viewStart),
    boundedDuration
  );
  if (windowDuration >= boundedDuration) {
    return { start: 0, end: boundedDuration };
  }
  const nextStart = Math.min(
    Math.max(0, time - windowDuration / 2),
    boundedDuration - windowDuration
  );
  return {
    start: nextStart,
    end: nextStart + windowDuration
  };
}

export function followPlaybackView(
  time: number,
  viewStart: number,
  viewEnd: number,
  duration: number,
  followRatio = 0.72
): ViewWindow {
  const windowDuration = Math.max(0, viewEnd - viewStart);
  const boundedRatio = Math.min(Math.max(followRatio, 0), 1);
  const followEdge = viewStart + windowDuration * boundedRatio;
  if (windowDuration >= duration) {
    return { start: viewStart, end: viewEnd };
  }
  if (time < viewStart) {
    const leadingRatio = 1 - boundedRatio;
    const nextStart = Math.min(
      Math.max(0, time - windowDuration * leadingRatio),
      Math.max(0, duration - windowDuration)
    );
    return {
      start: nextStart,
      end: nextStart + windowDuration
    };
  }
  if (time <= followEdge) {
    return { start: viewStart, end: viewEnd };
  }
  const nextStart = Math.min(
    Math.max(0, time - windowDuration * boundedRatio),
    Math.max(0, duration - windowDuration)
  );
  return {
    start: nextStart,
    end: nextStart + windowDuration
  };
}

export function zoomViewWindow(
  anchorTime: number,
  anchorRatio: number,
  factor: number,
  viewStart: number,
  viewEnd: number,
  duration: number,
  minimumWindow = 2
): ViewWindow {
  const currentWindow = Math.max(0, viewEnd - viewStart);
  const nextWindow = Math.min(
    Math.max(currentWindow * factor, Math.min(minimumWindow, duration)),
    duration
  );
  const boundedRatio = Math.min(Math.max(anchorRatio, 0), 1);
  const nextStart = Math.min(
    Math.max(0, anchorTime - nextWindow * boundedRatio),
    Math.max(0, duration - nextWindow)
  );
  return {
    start: nextStart,
    end: nextStart + nextWindow
  };
}

export function panViewWindow(
  deltaSeconds: number,
  viewStart: number,
  viewEnd: number,
  duration: number
): ViewWindow {
  const windowDuration = Math.max(0, viewEnd - viewStart);
  const nextStart = Math.min(
    Math.max(0, viewStart + deltaSeconds),
    Math.max(0, duration - windowDuration)
  );
  return {
    start: nextStart,
    end: nextStart + windowDuration
  };
}
