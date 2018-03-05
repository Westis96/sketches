function Brick(pos, r) {
  this.pos = createVector(random(50, pgWidth - 50), random(50, pgHeight - 200));
  this.r = random(10, 30);
  this.total = 6;

  this.display = function() {
    pg.push();
    pg.translate(this.pos.x, this.pos.y);
    pg.beginShape();
    for (var i = 0; i < this.total; i++) {
      var angle = map(i, 0, this.total, 0, TWO_PI);
      var r = this.r;
      var x = r * cos(angle);
      var y = r * sin(angle);
      pg.vertex(x, y);
    }
    pg.endShape(CLOSE);
    pg.pop();
  }
}
