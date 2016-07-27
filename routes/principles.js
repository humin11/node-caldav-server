import express from 'express';
import pHandler from '../dao/p';

let router = express.Router();

router.propfind('/', function(req, res, next) {
  pHandler.handlePropfind(req, res, next);
});

router.proppatch('/', function(req, res, next) {
  pHandler.handleProppatch(req, res, next);
});

router.options('/', function(req, res, next) {
  pHandler.handleOptions(req, res, next);
});

router.report('/', function(req, res, next) {
  pHandler.handleReport(req, res, next);
});


module.exports = router;
