const mongoose=require('mongoose')
const redis=require('redis')
const util=require('util')

const redisUrl='redis://127.0.0.1:6379'
const client=redis.createClient(redisUrl)

// Promify redis hget function
client.hget=util.promisify(client.hget)

const exec=mongoose.Query.prototype.exec

// Create cache toggler function
mongoose.Query.prototype.cache=function(options={}) {
    this.useCache=true
    this.hashKey=JSON.stringify(options.key||'')

    // return the query properties  to this function chainable
    return this
}

mongoose.Query.prototype.exec=async function() {
    // if not chacheable, run exec function.
    if(!this.useCache) {
        return exec.apply(this,arguments)
    }

    // Create a unique cache key for each distinct query
    const key=JSON.stringify(Object.assign({},this.getQuery(),{
        collection: this.mongooseCollection.name
    }))

    //  check redis for cache from this query
    const cacheValue=await client.hget(this.hashKey,key)

    // if there is cache of this query, return it.
    if(cacheValue) {
        const doc=JSON.parse(cacheValue)

        return Array.isArray(doc)
            ? doc.map(d => new this.model(d))
            :new this.model(doc)
    }
    // otherwise, issue the query and store the result in redis
    const result=await exec.apply(this,arguments)
    client.hset(this.hashKey,key,JSON.stringify(result),'EX',10)

    return result

}