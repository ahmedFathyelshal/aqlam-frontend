import { parseVideoSource } from './video-source';
import { WatchTracker } from './watch-tracker';

describe('WatchTracker', () => {
  it('counts continuous playback', () => {
    const tracker = new WatchTracker(100);
    for (let t = 0; t <= 50; t += 1) tracker.onTime(t);
    expect(tracker.watchedPercent).toBe(50);
  });

  it('ignores seeking forward, so jumping to the end does not complete the video', () => {
    const tracker = new WatchTracker(100);
    tracker.onTime(0);
    tracker.onTime(1);
    tracker.onTime(99); // seek
    tracker.onTime(100);
    expect(tracker.watchedPercent).toBe(2);
  });

  it('resumes from the progress already saved on the server', () => {
    const tracker = new WatchTracker(200, 50);
    tracker.onTime(100);
    tracker.onTime(102);
    expect(tracker.watchedPercent).toBe(51);
  });

  it('never exceeds 100%', () => {
    const tracker = new WatchTracker(10, 95);
    for (let t = 0; t <= 10; t += 1) tracker.onTime(t);
    expect(tracker.watchedPercent).toBe(100);
  });
});

describe('parseVideoSource', () => {
  it('turns YouTube watch, short and youtu.be links into API-enabled embeds', () => {
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
      const source = parseVideoSource(url);
      expect(source?.kind).toBe('youtube');
      expect(source && 'embedUrl' in source && source.embedUrl).toContain('/embed/dQw4w9WgXcQ?enablejsapi=1');
    }
  });

  it('recognises Vimeo and direct files', () => {
    expect(parseVideoSource('https://vimeo.com/123456')).toEqual({ kind: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456?api=1' });
    expect(parseVideoSource('https://cdn.example.com/lesson.mp4')?.kind).toBe('file');
  });

  it('never embeds unknown or malformed links', () => {
    expect(parseVideoSource('https://evil.example.com/page')?.kind).toBe('unknown');
    expect(parseVideoSource('javascript:alert(1)')?.kind).toBe('unknown');
    expect(parseVideoSource('http://cdn.example.com/lesson.mp4')?.kind).toBe('unknown'); // https only
    expect(parseVideoSource(null)).toBeNull();
  });
});
