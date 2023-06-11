module.exports = {
  client: "TEST",
  service: "onion-ptl-service",
  db: {
    // MySQL
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'onion_ptl',
    connectionLimit: 100,
    //timezone: 'UTC'
  },
  onion: {
    url: 'http://localhost:1337/',
    httpUser: 'user',
    httpPassword: 'password',
    timeout: 2000,
    client: '',
    userId: 1,
    wfEvent: 'PickingPtlConfirm'
  },
  // Mode de treball: indiquem el mode que s'encarregarà de controlar l'execució del servei. Modes disponibles:
  // Ha de correspondre amb el nom del mòdul de dins de api/moduels/modes, ja que es fa injecció de dependències
  // a dins de ControlPTL
  // - pickfighter
  // - pick2lightonion
  mode: {
    name: "pickfighter",
    configuration: {
      enableAddKey: true,     // if enabled the operator can press + key to increase quantity
      enableSubkey: true,     // if enabled the operator can press - key to decrease quantity
      enableFunctionKey: true // if enabled the operator cak press F key to switch between movements if there are more than once on a PTL
    }
  },

  jobs: {
    // Job to resend a movement to the PTL if the PTL has not confirmed its reception in less than a second
    ResendToPTL: {
      schedule: '* * * * * *',  // Cada segon
      active: 1
    },
    // Job to resend a movement confirmation to Onion if Onion is not reacheable, if Onion replies 
    // with an error the movement is set as error and does not retries.
    ResendToOnion: {
      //schedule: '*/5 * * * * *',  // Cada 5 segons
      schedule: '0 * * * * *',  // Cada minut
      active: 1
    },
    ImportOrders: {
      schedule: '0 * * * * *',  // Cada minut
      active: 1
    }
  }
}