import assert from 'assert';
import Matrix from '../../../src/recurrent/matrix';

describe('matrix', function() {
  it('.fromArray', function() {
    var m1 = Matrix.fromArray([
      [2, 2],
      [2, 2]
    ]);

    assert.equal(m1.weights.length, 4);
    assert.equal(m1.recurrence.length, 4);
    m1.weights.forEach(function(value, i) {
      assert.equal(value, 2);
      assert.equal(m1.recurrence[i], 2);
    });
  });

  describe('instantiation', function() {
    context('when given 5 rows and 5 columns', function() {
      it('will have a weight and recurrence length of 25', function() {
        var m = new Matrix(5, 5);
        assert.equal(m.weights.length, 25);
        assert.equal(m.recurrence.length, 25);
      });
    });
  });
});