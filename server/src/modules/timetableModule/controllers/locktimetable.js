const ClassTable = require("../../../models/classtimetable");
const LockSem = require("../../../models/locksem");



const HttpException = require("../../../models/http-exception");

const LockTimeTabledto = require("../dto/locktimetable");
const LockTimeTableDto = new LockTimeTabledto();
const TimeTabledto=require("../dto/timetable")
const TimeTableDto=new TimeTabledto(); 

const ClassTimeTabledto = require("../dto/classtimetable");
const ClassTimeTableDto = new ClassTimeTabledto();

const NoteController=require("./noteprofile")
const Notecontroller= new NoteController();

const MasterclasstableController=require("./masterclasstable")
const MasterClassTableController= new MasterclasstableController();

const getIndianTime=require("../helper/getIndianTime") 

class LockTimeTableController {
  async locktt(req, res) {
    async function locktt(req, res) {
      try {
        const { code } = req.body;
    
        // Delete all existing records in 'LockSem' for the given code
        await LockSem.deleteMany({ code });
    
        // Fetch data from 'ClassTable' based on the code
        const classTableData = await ClassTable.find({ code });
    
        if (!classTableData.length) {
          return res.status(404).json({ error: "No data found for the provided code." });
        }
    
        // Prepare bulk insert operations
        const bulkOperations = classTableData.map((dataItem) => ({
          insertOne: { document: dataItem.toObject() },
        }));
    
        // Perform bulk insert
        if (bulkOperations.length > 0) {
          await LockSem.bulkWrite(bulkOperations);
        }
    
        // Get the current Indian time
        const timenow = Date.now();
        const formattedtime = getIndianTime(timenow);
    
        // Send response first to avoid UI delay
        res.status(200).json({ message: "Data Locked successfully!", updatedTime: formattedtime });
    
        // Execute MasterTable logic asynchronously
        await MasterClassTableController.createMasterTable(req.body);
        
      } catch (err) {
        console.error("Error in locktt:", err);
        res.status(500).json({ error: "An error occurred" });
      }
    }
    
        }
 

  async classtt(req, res) {
    try {
      const code = req.params.code;
      const sem = req.params.sem;

      const records = await LockSem.find({ sem, code });
      const timetableData = {};  
      records.forEach((record) => {
        const { day, slot, slotData } = record;
        if (!timetableData[day]) {
          timetableData[day] = {};
        }
        
        if (!timetableData[day][slot]) {
          timetableData[day][slot] = [];
        }
  
      const formattedSlotData = slotData.map(({ subject, faculty, room }) => ({
      subject,
      faculty,
      room,
    }));

    timetableData[day][slot].push(formattedSlotData);
        timetableData.sem = sem;
        timetableData.code = code;
      });
  const notes= await Notecontroller.getNoteByCode(code,'sem',sem)
      res.status(200).json({timetableData,notes});
    } catch (error) {
      console.error(error);
      throw new Error('Error fetching and formatting data from the database');
    }
  }
  

  async facultytt(req, res) {
    
    const code=req.params.code;
    let session ='';
   const  facultyname=req.params.faculty;      
       try {  
      if(!req.params.session)
      {
      session = await TimeTableDto.getSessionByCode(req.params.code);
       }
      else
      {
      session=req.params.session;
      // const facultyId=req.params.facultyId;
      // facultyname = await findFacultyById(facultyId); 
    }
      const records = await LockTimeTableDto.findFacultyDataWithSession(session,facultyname);
      const updatedTime= await ClassTimeTableDto.getLastUpdatedTime(records);
      // Create an empty timetable data object
      const timetableData = {};
  
      // Iterate through the records and format the data
      records.forEach((record) => {
        // Extract relevant data from the record
        const { day, slot, slotData,sem } = record;
  
        // Create or initialize the day in the timetableData
        if (!timetableData[day]) {
          timetableData[day] = {};
        }
  
        // Create or initialize the slot in the day
        if (!timetableData[day][slot]) {
          timetableData[day][slot] = [];
        }
   // Iterate through the slotData array and filter based on faculty name
   const matchingSlotData = slotData.filter((slotItem) => slotItem.faculty === facultyname);

   // Access the matching values from the filtered slotData and push them
   const formattedSlotData = matchingSlotData.map(({ subject, room }) => ({
       subject,
       sem,
       room,
   }));

    timetableData[day][slot].push(formattedSlotData);
        // Set the sem and code for the timetable
      });
      // console.log(timetableData)
  const notes= await Notecontroller.getNoteByCode(code,'faculty',facultyname)

      res.status(200).json({timetableData,updatedTime,notes});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  
  async roomtt(req, res) {
    const roomno = req.params.room; 
    const code=req.params.code;
    // console.log('room no:', roomno);
    try {
      let session ='';
      if(!req.params.session)
      {
      session = await TimeTableDto.getSessionByCode(code);
      }
      else
      {
      session=req.params.session;
      }
      
      const records = await LockTimeTableDto.findRoomDataWithSession(session,roomno);
      const updatedTime= await ClassTimeTableDto.getLastUpdatedTime(records);
      const timetableData = {};
      records.forEach((record) => {
      const { day, slot, slotData,sem } = record;
        if (!timetableData[day]) {
          timetableData[day] = {};
        }
        if (!timetableData[day][slot]) {
          timetableData[day][slot] = [];
        }
   
   // Iterate through the slotData array and filter based on faculty name
   const matchingSlotData = slotData.filter((slotItem) => slotItem.room === roomno);
 
  const formattedSlotData = matchingSlotData.map(({ subject, faculty }) => ({
      subject,
      faculty,    
      sem,
    }));

    timetableData[day][slot].push(formattedSlotData);
        // Set the sem and code for the timetable
      });
  const notes= await Notecontroller.getNoteByCode(code,'room',roomno)

      // console.log('rooom data',timetableData)
      res.status(200).json({timetableData, updatedTime,notes});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getLastUpdatedTimeByCode(code) {
    const lockTime = await LockSem.find({ code }).sort({ updated_at: -1 }).limit(1);
    const saveTime = await ClassTable.find({ code }).sort({ updated_at: -1 }).limit(1);
  
    const lockTimeIST = lockTime.length > 0 ? await getIndianTime(new Date(lockTime[0].updated_at)) : null;
    const saveTimeIST = saveTime.length > 0 ? await getIndianTime(new Date(saveTime[0].updated_at)) : null;
  
    console.log(lockTimeIST);
    console.log(saveTimeIST);
  
    return {
      lockTimeIST,
      saveTimeIST
    };
  }

  async deleteLockedTableByCode(code) {
    try {

      await LockSem.deleteMany({ code });

    } catch (error) {
      throw new Error("Failed to delete by code");
    }
  }
    

}
module.exports = LockTimeTableController;



