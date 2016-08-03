import express from 'express';
import handlePrincipal from '../dao/principal';

let router = express.Router();

router.propfind('/', function(req, res, next) {
  handlePrincipal.handlePropfind(req, res, next);
});

router.proppatch('/', function(req, res, next) {
  handlePrincipal.handleProppatch(req, res, next);
});

router.patch('/', function(req, res, next) {
  handlePrincipal.handleProppatch(req, res, next);
});

router.options('/', function(req, res, next) {
  handlePrincipal.handleOptions(req, res, next);
});

router.report('/', function(req, res, next) {
  handlePrincipal.handleReport(req, res, next);
});

router.get('/', function(req, res, next) {
  handlePrincipal.handleReport(req, res, next);
});



module.exports = router;
