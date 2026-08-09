const Profile = require("../models/Profile");


// Create Profile
const createProfile = async (req, res) => {

    try {

        const {
            userId,
            username,
            displayName,
            bio,
            skills,
            interests
        } = req.body;


        const existingProfile = await Profile.findOne({
            userId
        });


        if(existingProfile){
            return res.status(400).json({
                message:"Profile already exists"
            });
        }


        const profile = await Profile.create({

            userId,
            username,
            displayName,
            bio,
            skills,
            interests

        });


        res.status(201).json({

            success:true,
            profile

        });


    } catch(error){

        res.status(500).json({

            success:false,
            message:error.message

        });

    }

};



// Get Profile

const getProfile = async(req,res)=>{

    try{

        const profile = await Profile.findOne({

            username:req.params.username

        });


        if(!profile){

            return res.status(404).json({

                message:"Profile not found"

            });

        }


        res.json({

            success:true,
            profile

        });


    }catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};



// Update Profile

const updateProfile = async(req,res)=>{

    try{


        const profile = await Profile.findOneAndUpdate(

            {
                username:req.params.username
            },

            req.body,

            {
                new:true
            }

        );


        res.json({

            success:true,
            profile

        });


    }catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};



module.exports = {

    createProfile,
    getProfile,
    updateProfile

};