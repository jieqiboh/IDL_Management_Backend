import { PrismaClient } from "@prisma/client";
import express from "express";
import pkg from "formidable";
const { formidable } = pkg;
import fs from "fs"
import cors from 'cors'

const prisma = new PrismaClient();

const app = express();

const corsOptions = {
  origin: 'http://localhost:3000', // Allow requests from a specific origin
  methods: ['GET', 'POST'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
};

app.use(cors(corsOptions));

// Register and set up the middleware
app.use(express.urlencoded({ extended: true }));

//takes svcname, vname, upstreamurl and a file, creates a svc and a version
app.post("/createSvc", async (req, res) => {
  const form = new formidable.IncomingForm();
  // Parse `req` and upload all associated files

  form.parse(req, async function (err, fields, files) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const filepath = files.filetoupload.filepath; //filetoupload is the name of the file in the form in the req
    const { svcname, vname, upstreamurl } = fields;

    try {
      const microsvc = await prisma.microservice.create({
        data: {
          svcname: svcname,
          versions: {
            create: [
              {
                vname: vname,
                upstreamurl: upstreamurl,
                idlfile: await convertFileToBytes(filepath),
              },
            ],
          },
        },
        include: {
          versions: true,
        },
      });
  
      res.json({ yoursvc: microsvc });
  
      res.status(200);
    } catch (err) {
      res.status(400).json({ error: err })
    }
  });
});

//takes a svcname and returns the svc object
app.post("/findSvc", async (req, res) => {
  const form = new formidable.IncomingForm();
  // Parse `req` and upload all associated files

  form.parse(req, async function (err, fields, files) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { svcname } = fields;

    const microsvc = await prisma.microservice.findUnique({
      where: {
        svcname: svcname,
      },
    });

    res.json({ yoursvc: microsvc });

    res.status(200);
  });
});

//takes microserviceId, vname, upstreamurl and a file, creates a version attached to that svc
app.post("/createVer", async (req, res) => {
  const form = new formidable.IncomingForm();
  // Parse `req` and upload all associated files

  form.parse(req, async function (err, fields, files) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const filepath = files.filetoupload.filepath; //filetoupload is the name of the file in the form in the req
    const { svcname, vname, upstreamurl } = fields;

    const microsvc = await prisma.microservice.findUnique({
      where: {
        svcname: svcname,
      },
    });

    if (!microsvc) {
      console.error("Microservice not found");
      res.status(400).json({ error: "Microservice not found" });
      return;
    } else {
      // Create a new version and associate it with the microservice
      const version = await prisma.version.create({
        data: {
          vname: vname, // Replace with the actual version name
          upstreamurl: upstreamurl, // Replace with the actual upstream URL
          idlfile: await convertFileToBytes(filepath),
          microservice: { connect: { id: microsvc.id } },
        },
      });

      res.status(200).json({ message: "Successfully created version for microsvc! "});
    }
  });
});

//returns all the svcs
app.get("/findAllSvc", async (req, res) => {
  try {
    const microsvcs = await prisma.microservice.findMany()

    res.status(200).json({ microsvcs: microsvcs })
  } catch (err) {
    res.status(400).json({ error: err })
  }
});

//returns all the versions of a svc
app.post("/findAllSvcVer", async (req, res) => {
  const form = new formidable.IncomingForm();
  // Parse `req` and upload all associated files

  form.parse(req, async function (err, fields, files) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { svcname } = fields;

    const microsvc = await prisma.microservice.findUnique({
      where: {
        svcname: svcname,
      },
      include: {
        versions: true,
      },
    });

    if (!microsvc) {
      console.error("Microservice not found");
      res.status(400).json({ error: "Microservice not found" });
      return;
    } else {
      res.status(200).json({ microsvc: microsvc })
    }
  });
});

//returns all the svcs and their versions
app.get("/findAllInfo", async (req, res) => {
  try {
    const microsvcs = await prisma.microservice.findMany({
      include: {
        versions: true,
      },
    })

    res.status(200).json({ microsvcs: microsvcs })
  } catch (err) {
    res.status(400).json({ error: err })
  }
});

//returns all the svcs and their versions
app.post("/findSvcVerIDL", async (req, res) => {
  //req should provide vname and microserviceId
  try {
    const form = new formidable.IncomingForm();

    form.parse(req, async function (err, fields, files) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
  
      const { microserviceId, vname } = fields;
  
      const microservice = await prisma.microservice.findUnique({ 
        where: {
            id: microserviceId
        }
      })
  
      const version = await prisma.version.findFirst({
        where: {
          microservice,
          vname: vname
        },
        select: {
          idlfile: true,
        },
      });

      if (version) {
        const idlfile = Buffer.from(version.idlfile);
        res.status(200).json({ idlfile: idlfile })
        // await fs.promises.writeFile('output.thrift', idlfile);
        // Process the idlfile as needed
      } else {
        console.log('No version found for the microservice.');
      }
    });

    
  } catch (err) {
    res.status(400).json({ error: err })
  }
});

app.get("/", async (req, res) => {
  // const user = await User.findById(req.session!.userId).select('-password -__v -createdAt -updatedAt')

  // res.json(user)
  res.status(200).json({ message: "get req works!" });
});

app.listen(3333, () => {
  console.log("Server is running on port 3333");
});

async function convertFileToBytes(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
