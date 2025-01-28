var express = require('express');
const cors = require('cors');
let router = express.Router();

router.use(cors());
router.use(express.json());

router.get('/', (req, res)=> {
  res.status(202).json(
    {
      VERSION: 1.0,
      NAME: 'EpicStudia'
    }
  )  
})

module.exports = router;