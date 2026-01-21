// Simple Pong game
// Controls: mouse (move paddle) or ArrowUp / ArrowDown keys. Space to pause/resume.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreboardPlayer = document.getElementById('playerScore');
  const scoreboardCPU = document.getElementById('cpuScore');

  // Logical size (we use canvas width/height attributes — CSS scales it visually)
  const W = canvas.width;
  const H = canvas.height;

  // Game objects
  const paddleWidth = 14;
  const paddleHeight = 100;
  const paddleInset = 20;

  const player = {
    x: paddleInset,
    y: (H - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 8,
    score: 0
  };

  const cpu = {
    x: W - paddleInset - paddleWidth,
    y: (H - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 5, // CPU maximum speed per frame
    score: 0
  };

  const ball = {
    x: W / 2,
    y: H / 2,
    r: 9,
    speed: 5,
    vx: 5,
    vy: 2
  };

  let running = true;
  let keys = { ArrowUp: false, ArrowDown: false };
  let lastTime = performance.now();
  const maxScore = 10;

  // Utility
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Reset ball after score. 'toward' is 'player' or 'cpu' to send ball to that side.
  function resetBall(toward = 'player') {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.speed = 5;
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6); // -30 to 30 degrees
    const dir = toward === 'player' ? -1 : 1;
    ball.vx = dir * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  // Start initial direction randomly
  resetBall(Math.random() < 0.5 ? 'player' : 'cpu');

  // Input: mouse move inside canvas -> center paddle on mouse y
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const mouseY = (e.clientY - rect.top) * scaleY;
    player.y = clamp(mouseY - player.height / 2, 0, H - player.height);
  });

  // Keyboard input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = true;
      e.preventDefault();
    }
    if (e.code === 'Space') {
      running = !running;
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = false;
      e.preventDefault();
    }
  });

  // Main update loop
  function update(dt) {
    // Player keyboard movement
    if (keys.ArrowUp) player.y -= player.speed;
    if (keys.ArrowDown) player.y += player.speed;
    player.y = clamp(player.y, 0, H - player.height);

    // CPU simple AI: follow ball with limited speed and a tiny "inaccuracy"
    const cpuCenter = cpu.y + cpu.height / 2;
    const diff = ball.y - cpuCenter;
    // small lead / difficulty: only move if ball is traveling towards CPU or if it's already past midline
    const shouldChase = ball.vx > 0 || ball.x > W * 0.3;
    if (shouldChase) {
      const move = clamp(diff * 0.12, -cpu.speed, cpu.speed); // proportional control
      cpu.y += move;
    } else {
      // slowly return to center
      const centerDiff = (H / 2) - cpuCenter;
      cpu.y += clamp(centerDiff * 0.05, -cpu.speed, cpu.speed);
    }
    cpu.y = clamp(cpu.y, 0, H - cpu.height);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collisions (top/bottom)
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
    } else if (ball.y + ball.r >= H) {
      ball.y = H - ball.r;
      ball.vy = -ball.vy;
    }

    // Paddle collisions (circle vs rect AABB approximation)
    function checkPaddleCollision(p) {
      if (ball.x - ball.r < p.x + p.width &&
          ball.x + ball.r > p.x &&
          ball.y + ball.r > p.y &&
          ball.y - ball.r < p.y + p.height) {
        // collision occurred
        // compute hit position relative to paddle center (-1 .. 1)
        const paddleCenter = p.y + p.height / 2;
        const relativeIntersectY = (ball.y - paddleCenter);
        const normalized = relativeIntersectY / (p.height / 2);
        // max bounce angle (radians)
        const maxBounce = (5 * Math.PI) / 12; // ~75 degrees
        const bounceAngle = normalized * maxBounce;

        // new speed slightly increased
        ball.speed = Math.min(ball.speed * 1.05, 15);

        // direction depends on which paddle
        const direction = (p === player) ? 1 : -1; // ball should move right after hitting player (left paddle), left after hitting cpu
        ball.vx = direction * ball.speed * Math.cos(bounceAngle);
        ball.vy = ball.speed * Math.sin(bounceAngle);

        // Push ball outside of paddle to prevent sticking
        if (p === player) {
          ball.x = p.x + p.width + ball.r + 0.5;
        } else {
          ball.x = p.x - ball.r - 0.5;
        }
      }
    }

    checkPaddleCollision(player);
    checkPaddleCollision(cpu);

    // Score: ball passed left or right
    if (ball.x + ball.r < 0) {
      // CPU scores
      cpu.score += 1;
      scoreboardCPU.textContent = cpu.score;
      if (!checkGameOver()) resetBall('cpu');
    } else if (ball.x - ball.r > W) {
      // Player scores
      player.score += 1;
      scoreboardPlayer.textContent = player.score;
      if (!checkGameOver()) resetBall('player');
    }
  }

  function checkGameOver() {
    if (player.score >= maxScore || cpu.score >= maxScore) {
      running = false;
      // Show text in console and on canvas; leave scores where they are
      // Could add restart behavior. For now space resumes or you can refresh.
      return true;
    }
    return false;
  }

  // Rendering
  function draw() {
    // clear
    ctx.clearRect(0, 0, W, H);

    // background subtle center line
    ctx.fillStyle = 'rgba(125,211,252,0.04)';
    ctx.fillRect(0, 0, W, H);

    // dashed center line
    ctx.strokeStyle = 'rgba(125,211,252,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 10);
    ctx.lineTo(W / 2, H - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, player.x, player.y, player.width, player.height, 6, true);
    roundRect(ctx, cpu.x, cpu.y, cpu.width, cpu.height, 6, true);

    // ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // scores drawn via DOM, but show a subtle HUD
    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W / 2 - 160, H / 2 - 40, 320, 80);
      ctx.fillStyle = '#fff';
      ctx.font = '20px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.score >= maxScore ? 'You win! (Space to restart)' : (cpu.score >= maxScore ? 'CPU wins! (Space to restart)' : 'Paused'), W / 2, H / 2 + 6);
    }
  }

  // helper for rounded rect
  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  }

  // Game loop
  function loop(now) {
    const dt = (now - lastTime) / 16.6667; // approx frames relative (60fps baseline)
    lastTime = now;

    if (running) update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Optional: pause/resume and reset when space pressed and game over
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !running) {
      // if game over, reset scores if someone reached maxScore
      if (player.score >= maxScore || cpu.score >= maxScore) {
        player.score = 0;
        cpu.score = 0;
        scoreboardPlayer.textContent = '0';
        scoreboardCPU.textContent = '0';
      }
      running = true;
      resetBall(Math.random() < 0.5 ? 'player' : 'cpu');
    }
  });

  // Keep canvas crisp on high-DPI screens
  function adjustCanvasForDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // On resize adjust but preserve logical game size
  function onResize() {
    // keep logical coordinate system at W x H but scale canvas appropriately
    const rect = canvas.getBoundingClientRect();
    // Ensure canvas uses its attribute width/height for crispness
    canvas.width = W;
    canvas.height = H;
    // CSS scaling will be handled by layout - but to support high DPR we won't modify anymore
    // To keep it simple (and consistent), set canvas style size to the actual pixel size of the element
    canvas.style.width = (Math.min(860, window.innerWidth - 48)) + 'px';
    canvas.style.height = (canvas.style.width ? (canvas.width * (canvas.height / canvas.width) / parseFloat(canvas.style.width) * parseFloat(canvas.style.width)) : canvas.height + 'px');
  }

  // initial resize call
  onResize();
  window.addEventListener('resize', onResize);
})();
