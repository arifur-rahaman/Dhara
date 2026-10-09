import { describe, expect, it } from 'vitest';
import { videoEmbed } from '@/features/learning/video';
import { deviceLabel } from '@/lib/user-agent';

describe('device names in Settings', () => {
  it('names common phones and browsers', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome · Android');
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
      ),
    ).toBe('Edge · Windows');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Samsung Internet · Android');
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel('curl/8.0')).toBeNull();
  });
});

describe('course videos', () => {
  it('plays YouTube links through youtube-nocookie.com', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=abcDEF12345')).toEqual({
      kind: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/abcDEF12345',
    });
    expect(videoEmbed('https://youtu.be/abcDEF12345')?.src).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
  });

  it('treats other https links as video files and refuses anything else', () => {
    expect(videoEmbed('https://media.example.org/module-1.mp4')).toEqual({
      kind: 'file',
      src: 'https://media.example.org/module-1.mp4',
    });
    expect(videoEmbed('http://media.example.org/a.mp4')).toBeNull();
    expect(videoEmbed('javascript:alert(1)')).toBeNull();
    expect(videoEmbed('https://youtube.com/watch?v=<script>')).toBeNull();
    expect(videoEmbed(null)).toBeNull();
  });
});
