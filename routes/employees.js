var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var async = require('async');

const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');

var Employee = require('../models/employee');
// include the roles model to get roles for create_role_form
var Role = require('../models/role');


// landing pages for all things a manager can do with employee data
router.get('/', function(req, res){
  // res.send('employee HTML stuff');
  // show all employees on this page
  // filter only employees that are currently employeed
  const query = Employee.find({employeed: true}); // mongoose method
  query.exec(function(err,docs){
    if(err) throw Error;
    console.log(docs);
    res.render('employees',{
      emps: docs
    });
  });
});

// Login Route
router.get('/login', function(req, res){
  res.render('login'); // render a view to login
});



router.get('/create', function(req, res){
  // id like to have this in the role model
  var query = Role.find({}); // mongoose method
  query.exec(function(err,docs){
    if(err) throw Error;

    res.render('create_employee_form',{
      roles: docs
    });
  });
});



// POST request for creating and employee
router.post('/create',[
  // API - https://github.com/chriso/validator.js
  // figure out priority of error handling (only display one error per field if necessary validation schema?)
  // check('login_number').isLength({min:1}).withMessage('Must enter an employee number'),
  check('email').isEmail().withMessage('Enter a valid email address'),
  check('login_number').isLength({min:6, max:6}).withMessage('Employee number must be exactly 6 digits'),
  check('login_number').isInt().withMessage('Employee number can only contain numbers'),
  check('password').isLength({min:8}).withMessage('Please enter at least a 8 character temp password'),
  check('first_name').isLength({min:1}).withMessage('Must enter a First Name'),
  check('last_name').isLength({min:1}).withMessage('Must enter a Last Name'),
  check('ssn').isLength({min:9, max:9}).withMessage('SSN must be 9 numbers'),
  check('ssn').isInt().withMessage('SSN can only contain numbers'),
  check('birth_date').isLength({min:1}).withMessage('Must enter a 8 digit date date.'),
  check('genderSelect').exists().withMessage('Please enter a gender'),
  check('roleSelect').exists().withMessage('No roll. This message should never display.')


], (req, res, next) => {
  // get the validation result
  const errors = validationResult(req);
  // check for validation errors
  if(!errors.isEmpty()){
    console.log(errors.array()); // Jesus! finally. There is no tutorial for new API yet
    // id like to have this in the role model
    var query = Role.find({}); // mongoose method
    query.exec(function(err,docs){
      if(err) throw Error;

      res.render('create_employee_form',{
        roles: docs,
        errors: errors.array()
      });
    });

  } else {
    const checkData = matchedData(req); // validated data only
    // generate a PIN in the createEmployee method
    // console.log(checkData);
    // parse the role string
    var roleArray = checkData.roleSelect.split(' - ');
    // create PIN from YYYY of date
    var empPin = checkData.birth_date.substring(0,4);
    // create display name firstname + first letter of last
    var displayName = checkData.first_name + ' ' + checkData.last_name.substring(0,1);

    // create a new emp obj to send to the method for adding to db
    const newEmployee = new Employee({
      email: checkData.email,
      login_number: checkData.login_number,
      password: checkData.password,
      display_name: displayName,
      pin_num: empPin,
      first_name: checkData.first_name,
      middle_name: checkData.middle_name,
      last_name: checkData.last_name,
      ssn: checkData.ssn,
      gender: checkData.genderSelect,
      birth_date: new Date(checkData.birth_date),
      roles: [ {
        _id: roleArray[2],
        name: roleArray[0],
        rate_of_pay: roleArray[1],
        default: true // whatever you are hired in as is your default position
      }],
      hire_date: new Date(), // hired today!
      employeed: true // if youre hired today, you must be employeed logic AF
    });
    // console.log(newEmployee);
    // method store in the Employee Model
    Employee.createEmployee(newEmployee, function(err, employee){
      if(err) throw err;
      console.log(employee);
    });
    // success msg
    // in order for this msg to show, we need a placeholder in our layout template
    req.flash('success_msg', 'Successfully added a new employee');

    // reidrect
    res.redirect('/employees');
  }
});


// create a logout route
router.get('/logout', function(req, res){
  req.logout();
  // you might not want this notification when someone just goes to your url
  req.flash('success_msg', 'You are logged out');

  res.redirect('/employees/login');
});
//////////////////////////////////////////
///// why does logout work here but not below????
//////////////////////////////////////////



// route for GET one specific employee
router.get('/:id',(req,res,next)=>{
  // need to start using async
  // find out how to implement!!! it worked when i tried last june
  // console.log(req.params.id);
  var query = Employee.findById(req.params.id);
  query.exec(function(err,doc){
    if(err) throw Error;
    console.log('Find one Employee by ID');
    console.log(doc);

    res.render('employee_detail',{
      title: 'Admire your great employee',
      emp: doc
    });
  });
});



// view for updating an employee
router.get('/:id/update',function(req,res,next){
  var query = Employee.findById(req.params.id);
  query.exec(function(err,doc){
    if(err) throw Error;
    console.log('Employee to be updated');
    console.log(doc);

    res.render('employee_update',{
      title: "Update employee info for",
      emp:doc
    });
  });
});
// PUT request to update Employee Info
router.post('/:id/update',(req,res)=>{
  // dropped the validator for this one
  // we'll hardcode while we wait on a reply from devs on gitub
  // I DONT EVEN NEED THIS HERE Employee.getEmployeeById(req.params.id,function(err, employee){
    // just designed my own callback and i'm not sure how?
    // console.log(employee);
    // okay this is dangerous, but i'm just going to use the input
    // directly from the requst body and store it in the DB. i know, i know
    // This is REALLY VERY STUPID!
  var query = Employee.findOneAndUpdate({_id:req.params.id},req.body);
  query.exec((err,doc)=>{
    if(err) throw Error;
    console.log('New updated Employee document');
    console.log(doc);
    // another dumb hack. need to work on my routes
    res.redirect('/employees/'+req.params.id);
  }); // it's dumb, but it works.
});

// route to delete an employee
// note, this doesn't delete the employee, it merely changes employeed: false
// this way it wont show up in the Employees view


// strategy must come before login POST request
passport.use(new LocalStrategy({
  // rename fields
  // By default, LocalStrategy expects to find credentials in parameters named
  // username and password. If your site prefers to name these fields differently,
  // options are available to change the defaults.
  usernameField: 'login_number'
  // passwordField: 'password'
},
  function(login_number, password, done){
    // 2: working to here so far
    console.log('hey 2');
    Employee.getEmployeeByEmployeeNumber(login_number, function(err,user){
      // 4: working here so far
      console.log('hey 4');
      if(err) throw err;
      // if there is no username match
      if(!user){
        // 5: working here so far
        console.log('hey 5 - OR: username not in DB');
        return done(null, false, {message: 'Employee number not in DB.'});
      }
      // continue if there is an employee match
      console.log('hey 5 - OR: found employee');
      // user.password is the hashed password from the DB
      // remember, user is just the session global variable
      Employee.comparePassword(password, user.password, function(err, isMatch){
        if(err) throw err;
        if(isMatch){
          console.log('hey 7 - OR: passwords match');
          return done(null, user);
        } else {
          console.log('hey 7 - OR: passwords dont match');
          return done(null, false, {message: 'That aint the right password'});
        } // BOOM FrickALOOOOOOOOM!!!!! it all works

      });
    });

  }));

// serialize and deserialize
passport.serializeUser(function(user, done){
  // user is a session variable
  done(null, user.id);
});
passport.deserializeUser(function(id, done){
  // create this funcgion inside the model

  Employee.getEmployeeById(id, function(err, user){
    done(err, user);
  });
});









// // pass port authentication
router.post('/login', // entering nonnumbers throws error? mongoose model?
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/employees/login', // 1: working to here so far (changed route to test)
    failureFlash: true
  }),
  function(req,res){
    // if this function gets called, authentication was Successful
    // 'req.employee' contains the autenticated user
    res.redirect('/');
  });



module.exports = router;
