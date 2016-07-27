import db from './db';

export default {
    handlePropfind: function(req,res,next){
        res.json(req.method);
    },
    handleProppatch: function(req,res,next){
        res.json(req.method);
    },
    handleOptions: function(req,res,next){
        res.json(req.method);
    },
    handleReport: function(req,res,next){
        res.json(req.method);
    },
    
}