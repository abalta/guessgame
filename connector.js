function connectToServer() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:9090');
    try {
      resolve(ws)
    } catch (error) {
      reject(error);
    }
  })
  // return new Promise((resolve, reject) => {
  //   const timer = setInterval(() => {
  //     if (ws.readyState === 1) {
  //       clearInterval(timer)
  //       resolve(ws);
  //     }
  //   }, 10);
  // });
}