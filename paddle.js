function Paddle() {
  this.w = 60;
  this.h = 10;
  this.pos = createVector(pgWidth / 2 - this.w / 2, pgHeight - 40);
  this.isMovingLeft = false;
  this.isMovingRight = false;

  this.display = function() {
    pg.rect(this.pos.x, this.pos.y, this.w, this.h);
  }

  this.update = function() {
    if (this.isMovingLeft) {
      this.move(-20);
    } else if (this.isMovingRight) {
      this.move(20);
    }
  }

  this.move = function(step) {
    this.pos.x += step;
  }

  this.checkEdges = function() {
    if (this.pos.x <= 0) this.pos.x = 0;
    else if (this.pos.x + this.w >= pgWidth) this.pos.x = pgWidth - this.w;
  }
}
