const mongoose=require('mongoose')
const redis=require('redis')
const util=require('util')

const redisUrl='redis://127.0.0.1:6379'
const client=redis.createClient(redisUrl)

// Promify redis get function
client.get=util.promisify(client.get)

const exec=mongoose.Query.prototype.exec

mongoose.Query.prototype.exec=async function() {
    // Create a unique cache key for each distinct query
    const key=JSON.stringify(Object.assign({},this.getQuery(),{
        collection: this.mongooseCollection.name
    }))

    //  check redis for cache from this query
    const cacheValue=await client.get(key)

    // if there is cache of this query, return it.
    if(cacheValue) {
        const doc=JSON.parse(cacheValue)

        return Array.isArray(doc)
            ? doc.map(d => new this.model(d))
            :new this.model(doc)
    }
    // otherwise, issue the query and store the result in redis
    const result=await exec.apply(this,arguments)
    client.set(key,JSON.stringify(result))

    return result

}