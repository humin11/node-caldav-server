import express from 'express';
import handlePrincipal from '../dao/principal';

let router = express.Router();

router.route('/')
      .propfind(function(...args) {
        handlePrincipal.handlePropfind(...args);
      })
      .proppatch(function(...args) {
        handlePrincipal.handleProppatch(...args);
      })
      .options(function(...args) {
        handlePrincipal.handleOptions(...args);
      })
      .report(function(...args) {
        handlePrincipal.handleReport(...args);
      })
      .get(function(...args) {
        handlePrincipal.handleReport(...args);
      })

module.exports = router;
