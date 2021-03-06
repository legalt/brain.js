/**
 *
 * @param {Matrix} product
 * @param {Matrix} left
 */
export default function tanhB(product, left) {
  for(let i = 0, max = product.recurrence.length; i < max; i++) {
    // grad for z = tanh(x) is (1 - z^2)
    let mwi = product.weights[i];
    left.recurrence[i] += (1 - mwi * mwi) * product.recurrence[i];
  }
}
