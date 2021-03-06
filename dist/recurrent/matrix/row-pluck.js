"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rowPluck;
/**
 * @param {Matrix} product
 * @param {Matrix} left
 * @param {Number} rowPluckIndex
 */
function rowPluck(product, left, rowPluckIndex) {
  for (var column = 0, columns = left.columns; column < columns; column++) {
    product.weights[column] = left.weights[columns * rowPluckIndex + column];
  }
}
//# sourceMappingURL=row-pluck.js.map