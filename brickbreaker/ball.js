function Ball() {
  this.pos = createVector((pgWidth / 3) + random(-10, 100) , (pgHeight / 2));

  this.r = 10;
  this.vel = createVector(1, 1).mult(4);
  this.direction = createVector(1, 1);

  this.update = function() {
    this.pos.x += this.vel.x * this.direction.x;
    this.pos.y += this.vel.y * this.direction.y;
  }

  this.display = function() {
    pg.ellipse(this.pos.x, this.pos.y, this.r * 2, this.r * 2);
  }

  this.checkEdges = function() {
    if (this.pos.x > pgWidth - this.r && this.direction.x > 0) {
      this.direction.x *= -1;
    }
    if (this.pos.x < this.r && this.direction.x < 0) {
      this.direction.x *= -1;
    }
    if (this.pos.y < this.r && ball.direction.y < 0) this.direction.y *= -1;
  }

  this.meets = function(paddle) {
    if (this.pos.y < paddle.pos.y &&
        this.pos.y > paddle.pos.y - this.r &&
        ball.pos.x > paddle.pos.x - ball.r &&
        ball.pos.x < paddle.pos.x + paddle.w + ball.r) {
      return true;
    } else {
      return false;
    }
  }

  this.hits = function(brick) {
    var d = dist(this.pos.x, this.pos.y, brick.pos.x, brick.pos.y);
    if (d < brick.r + this.r) {
      return true;
    } else {
      return false;
    }
  }
}
