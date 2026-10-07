import type { BrowserContext } from "@playwright/test";

// Transport fixture only: the real @vimeo/player SDK, UI, Auth, API and database
// remain in use. The live integration is a separate required commit status.
export async function installVimeoContract(context: BrowserContext) {
  await context.route("https://player.vimeo.com/video/**", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body><p>Player contract fixture</p><script>
      let position = 0;
      const duration = 597, listeners = new Set();
      const reply = (message) => parent.postMessage(message, ${JSON.stringify(new URL(process.env.E2E_BASE_URL!).origin)});
      addEventListener('message', event => {
        if (event.source !== parent) return;
        let data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
        const method = data?.method;
        if (method === 'ping') reply({method, value: true});
        else if (method === 'getVideoId') reply({method, value: 1084537});
        else if (method === 'getDuration') reply({method, value: duration});
        else if (method === 'getCurrentTime') reply({method, value: position});
        else if (method === 'getPlayed') reply({method, value: []});
        else if (method === 'addEventListener' || method === 'removeEventListener') {
          method === 'addEventListener' ? listeners.add(data.value) : listeners.delete(data.value);
          reply({method, value: true});
        } else if (method === 'setCurrentTime') {
          position = Math.max(0, Math.min(duration, Number(data.value)));
          reply({method, value: position});
          for (const event of ['seeked', 'timeupdate']) if (listeners.has(event)) reply({event, data: {seconds: position, duration}});
        } else reply({event:'error', data:{method, name:'UnsupportedError', message:'Unimplemented contract method'}});
      });
      reply({event:'ready'});
    </script></body></html>`,
  }));
}
